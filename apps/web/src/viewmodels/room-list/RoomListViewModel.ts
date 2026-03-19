/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    BaseViewModel,
    type RoomListViewSnapshot,
    type FilterId,
    type RoomListViewActions,
    type RoomListViewState,
    type RoomListSection,
    _t,
} from "@element-hq/web-shared-components";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import { Action } from "../../dispatcher/actions";
import dispatcher from "../../dispatcher/dispatcher";
import { type ViewRoomDeltaPayload } from "../../dispatcher/payloads/ViewRoomDeltaPayload";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import SpaceStore from "../../stores/spaces/SpaceStore";
import RoomListStoreV3, {
    CHATS_TAG,
    RoomListStoreV3Event,
    type RoomsResult,
} from "../../stores/room-list-v3/RoomListStoreV3";
import { FilterEnum } from "../../stores/room-list-v3/skip-list/filters";
import { RoomNotificationStateStore } from "../../stores/notifications/RoomNotificationStateStore";
import { RoomListItemViewModel } from "./RoomListItemViewModel";
import { SdkContextClass } from "../../contexts/SDKContext";
import { hasCreateRoomRights } from "./utils";
import { keepIfSame } from "../../utils/keepIfSame";
import { DefaultTagID } from "../../stores/room-list-v3/skip-list/tag";
import { RoomListSectionHeaderViewModel } from "./RoomListSectionHeaderViewModel";
import SettingsStore from "../../settings/SettingsStore";

interface RoomListViewModelProps {
    client: MatrixClient;
}

const filterKeyToIdMap: Map<FilterEnum, FilterId> = new Map([
    [FilterEnum.UnreadFilter, "unread"],
    [FilterEnum.PeopleFilter, "people"],
    [FilterEnum.RoomsFilter, "rooms"],
    [FilterEnum.FavouriteFilter, "favourite"],
    [FilterEnum.MentionsFilter, "mentions"],
    [FilterEnum.InvitesFilter, "invites"],
    [FilterEnum.LowPriorityFilter, "low_priority"],
]);

const TAG_TO_TITLE_MAP: Record<string, string> = {
    [DefaultTagID.Favourite]: _t("room_list|section|favourites"),
    [CHATS_TAG]: _t("room_list|section|chats"),
    [DefaultTagID.LowPriority]: _t("room_list|section|low_priority"),
};

export class RoomListViewModel
    extends BaseViewModel<RoomListViewSnapshot, RoomListViewModelProps>
    implements RoomListViewActions
{
    // State tracking
    private activeFilter: FilterEnum | undefined = undefined;
    private roomsResult: RoomsResult;
    private lastActiveRoomIndex: number | undefined = undefined;

    // Child view model management
    private roomItemViewModels = new Map<string, RoomListItemViewModel>();
    // Don't clear section vm because we want to keep the expand/collapse state even during space changes.
    private roomSectionHeaderViewModels = new Map<string, RoomListSectionHeaderViewModel>();
    private roomsMap = new Map<string, Room>();

    public constructor(props: RoomListViewModelProps) {
        const activeSpace = SpaceStore.instance.activeSpaceRoom;

        // Get initial rooms
        const roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(undefined);
        const canCreateRoom = hasCreateRoomRights(props.client, activeSpace);

        // Remove favourite and low priority filters if sections are enabled, as they are redundant with the sections
        const areSectionsEnabled = SettingsStore.getValue("feature_room_list_sections");
        const filterIds = [...filterKeyToIdMap.values()].filter(
            (id) => !areSectionsEnabled || (id !== "favourite" && id !== "low_priority"),
        );

        // By default, all sections are expanded
        const { sections, isFlatList } = computeSections(roomsResult, (tag) => true);
        const isRoomListEmpty = roomsResult.sections.every((section) => section.rooms.length === 0);

        super(props, {
            // Initial view state - start with empty, will populate in async init
            isLoadingRooms: RoomListStoreV3.instance.isLoadingRooms,
            isRoomListEmpty,
            filterIds,
            activeFilterId: undefined,
            roomListState: {
                activeRoomIndex: undefined,
                spaceId: roomsResult.spaceId,
                filterKeys: undefined,
            },
            isFlatList,
            sections,
            canCreateRoom,
        });

        this.roomsResult = roomsResult;

        // Build initial roomsMap from roomsResult
        this.updateRoomsMap(roomsResult);

        // Subscribe to room list updates
        this.disposables.trackListener(
            RoomListStoreV3.instance,
            RoomListStoreV3Event.ListsUpdate as any,
            this.onListsUpdate,
        );

        // Subscribe to room list loaded
        this.disposables.trackListener(
            RoomListStoreV3.instance,
            RoomListStoreV3Event.ListsLoaded as any,
            this.onListsLoaded,
        );

        // Subscribe to active room changes to update selected room
        const dispatcherRef = dispatcher.register(this.onDispatch);
        this.disposables.track(() => {
            dispatcher.unregister(dispatcherRef);
        });

        // Track cleanup of all child view models
        this.disposables.track(() => {
            for (const viewModel of this.roomItemViewModels.values()) {
                viewModel.dispose();
            }
            this.roomItemViewModels.clear();
        });
    }

    public onToggleFilter = (filterId: FilterId): void => {
        // Find the FilterKey by matching the filter ID
        let filterKey: FilterEnum | undefined = undefined;
        for (const [key, id] of filterKeyToIdMap.entries()) {
            if (id === filterId) {
                filterKey = key;
                break;
            }
        }

        if (filterKey === undefined) return;

        // Toggle the filter - if it's already active, deactivate it
        const newFilter = this.activeFilter === filterKey ? undefined : filterKey;
        this.activeFilter = newFilter;

        // Update rooms result with new filter
        const filterKeys = this.activeFilter !== undefined ? [this.activeFilter] : undefined;
        this.roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filterKeys);

        // Update roomsMap immediately before clearing VMs
        this.updateRoomsMap(this.roomsResult);

        this.updateRoomListData();
    };

    /**
     * Rebuild roomsMap when roomsResult changes.
     * This maintains a quick lookup for room objects.
     */
    private updateRoomsMap(roomsResult: RoomsResult): void {
        this.roomsMap.clear();
        for (const room of roomsResult.sections.flatMap((section) => section.rooms)) {
            this.roomsMap.set(room.roomId, room);
        }
    }

    /**
     * Clear all child view models.
     * Called when the room list structure changes (space change, filter change, etc.)
     */
    private clearViewModels(): void {
        for (const viewModel of this.roomItemViewModels.values()) {
            viewModel.dispose();
        }
        this.roomItemViewModels.clear();
    }

    /**
     * Get the ordered list of room IDs.
     */
    public get roomIds(): string[] {
        return this.roomsResult.sections.flatMap((section) => section.rooms).map((room) => room.roomId);
    }

    /**
     * Get a RoomListItemViewModel for a specific room.
     * Creates a RoomListItemViewModel if needed, which manages per-room subscriptions.
     * The view should call this only for visible rooms from the roomIds list.
     * @throws Error if room is not found in roomsMap (indicates a programming error)
     */
    public getRoomItemViewModel(roomId: string): RoomListItemViewModel {
        // Check if we have a view model for this room
        let viewModel = this.roomItemViewModels.get(roomId);

        if (!viewModel) {
            const room = this.roomsMap.get(roomId);
            if (!room) {
                throw new Error(`Room ${roomId} not found in roomsMap`);
            }

            // Create new view model
            viewModel = new RoomListItemViewModel({
                room,
                client: this.props.client,
            });

            this.roomItemViewModels.set(roomId, viewModel);
        }

        // Return the view model - the view will call useViewModel() on it
        return viewModel;
    }

    public getSectionHeaderViewModel(tag: string): RoomListSectionHeaderViewModel {
        if (this.roomSectionHeaderViewModels.has(tag)) return this.roomSectionHeaderViewModels.get(tag)!;

        const title = TAG_TO_TITLE_MAP[tag] || tag;
        const viewModel = new RoomListSectionHeaderViewModel({
            tag,
            title,
            onToggleExpanded: () => this.updateRoomListData(),
        });
        this.roomSectionHeaderViewModels.set(tag, viewModel);
        return viewModel;
    }

    /**
     * Update which rooms are currently visible.
     * Called by the view when scroll position changes.
     * Disposes of view models for rooms no longer visible.
     */
    public updateVisibleRooms(startIndex: number, endIndex: number): void {
        const allRoomIds = this.roomIds;
        const newVisibleIds = allRoomIds.slice(startIndex, Math.min(endIndex, allRoomIds.length));

        const newVisibleSet = new Set(newVisibleIds);

        // Dispose view models for rooms no longer visible
        for (const [roomId, viewModel] of this.roomItemViewModels.entries()) {
            if (!newVisibleSet.has(roomId)) {
                viewModel.dispose();
                this.roomItemViewModels.delete(roomId);
            }
        }
    }

    private onDispatch = (payload: any): void => {
        if (payload.action === Action.ActiveRoomChanged) {
            // When the active room changes, update the room list data to reflect the new selected room
            // Pass isRoomChange=true so sticky logic doesn't prevent the index from updating
            this.updateRoomListData(true);
        } else if (payload.action === Action.ViewRoomDelta) {
            // Handle keyboard navigation shortcuts (Alt+ArrowUp/Down)
            // This was previously handled by useRoomListNavigation hook
            this.handleViewRoomDelta(payload as ViewRoomDeltaPayload);
        }
    };

    /**
     * Handle keyboard navigation shortcuts (Alt+ArrowUp/Down) to move between rooms.
     * Supports both regular navigation and unread-only navigation.
     * Migrated from useRoomListNavigation hook.
     */
    private handleViewRoomDelta(payload: ViewRoomDeltaPayload): void {
        const currentRoomId = SdkContextClass.instance.roomViewStore.getRoomId();
        if (!currentRoomId) return;

        const { delta, unread } = payload;
        const rooms = this.roomsResult.sections.flatMap((section) => section.rooms);

        const filteredRooms = unread
            ? // Filter the rooms to only include unread ones and the active room
              rooms.filter((room) => {
                  const state = RoomNotificationStateStore.instance.getRoomState(room);
                  return room.roomId === currentRoomId || state.isUnread;
              })
            : rooms;

        const currentIndex = filteredRooms.findIndex((room) => room.roomId === currentRoomId);
        if (currentIndex === -1) return;

        // Get the next/previous new room according to the delta
        // Use slice to loop on the list
        // If delta is -1 at the start of the list, it will go to the end
        // If delta is 1 at the end of the list, it will go to the start
        const [newRoom] = filteredRooms.slice((currentIndex + delta) % filteredRooms.length);
        if (!newRoom) return;

        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: newRoom.roomId,
            show_room_tile: true, // to make sure the room gets scrolled into view
            metricsTrigger: "WebKeyboardShortcut",
            metricsViaKeyboard: true,
        });
    }

    /**
     * Handle room list updates from RoomListStoreV3.
     *
     * This event fires when:
     * - Room order changes (new messages, manual reordering)
     * - Active space changes
     * - Filters are applied
     * - Rooms are added/removed
     *
     * Space changes are detected by comparing old vs new spaceId.
     * This matches the old hook pattern where space changes were handled
     * indirectly through room list updates.
     */
    private onListsUpdate = (): void => {
        const filterKeys = this.activeFilter !== undefined ? [this.activeFilter] : undefined;
        const oldSpaceId = this.roomsResult.spaceId;

        // Refresh room data from store
        this.roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filterKeys);
        this.updateRoomsMap(this.roomsResult);

        const newSpaceId = this.roomsResult.spaceId;

        // Detect space change
        if (oldSpaceId !== newSpaceId) {
            // Clear view models when the space changes
            // We only want to do this on space changes, not on regular list updates, to preserve view models when possible
            // The view models are disposed when scrolling out of view (handled by updateVisibleRooms)
            this.clearViewModels();

            // Space changed - get the last selected room for the new space to prevent flicker
            const lastSelectedRoom = SpaceStore.instance.getLastSelectedRoomIdForSpace(newSpaceId);

            this.updateRoomListData(true, lastSelectedRoom);
            return;
        }

        // Normal room list update (not a space change)
        this.updateRoomListData();
    };

    private onListsLoaded = (): void => {
        // Room lists have finished loading
        this.snapshot.merge({
            isLoadingRooms: false,
        });
    };

    /**
     * Calculate the active room index based on the currently viewed room.
     * Returns undefined if no room is selected or if the selected room is not in the current list.
     *
     * @param roomId - The room ID to find the index for (can be null/undefined)
     */
    private getActiveRoomIndex(roomId: string | null | undefined): number | undefined {
        if (!roomId) {
            return undefined;
        }

        const index = this.roomsResult.sections
            .flatMap((section) => section.rooms)
            .findIndex((room) => room.roomId === roomId);
        return index >= 0 ? index : undefined;
    }

    /**
     * Apply sticky room logic to keep the active room at the same index position.
     * When the room list updates, this prevents the selected room from jumping around in the UI.
     *
     * @param isRoomChange - Whether this update is due to a room change (not a list update)
     * @param roomId - The room ID to apply sticky logic for (can be null/undefined)
     * @returns The modified rooms array with sticky positioning applied
     */
    // private applyStickyRoom(isRoomChange: boolean, roomId: string | null | undefined): Room[] {
    //     const rooms = this.roomsResult.rooms;

    //     if (!roomId) {
    //         return rooms;
    //     }

    //     const newIndex = rooms.findIndex((room) => room.roomId === roomId);
    //     const oldIndex = this.lastActiveRoomIndex;

    //     // When opening another room, the index should obviously change
    //     if (isRoomChange) {
    //         return rooms;
    //     }

    //     // If oldIndex is undefined, then there was no active room before
    //     // Similarly, if newIndex is -1, the active room is not in the current list
    //     if (newIndex === -1 || oldIndex === undefined) {
    //         return rooms;
    //     }

    //     // If the index hasn't changed, we have nothing to do
    //     if (newIndex === oldIndex) {
    //         return rooms;
    //     }

    //     // If the old index falls out of the bounds of the rooms array
    //     // (usually because rooms were removed), we can no longer place
    //     // the active room in the same old index
    //     if (oldIndex > rooms.length - 1) {
    //         return rooms;
    //     }

    //     // Making the active room sticky is as simple as removing it from
    //     // its new index and placing it in the old index
    //     const newRooms = [...rooms];
    //     const [stickyRoom] = newRooms.splice(newIndex, 1);
    //     newRooms.splice(oldIndex, 0, stickyRoom);

    //     return newRooms;
    // }

    private async updateRoomListData(
        isRoomChange: boolean = false,
        roomIdOverride: string | null = null,
    ): Promise<void> {
        // Determine the room ID to use for calculations
        // Use override if provided (e.g., during space changes), otherwise fall back to RoomViewStore
        const roomId = roomIdOverride ?? SdkContextClass.instance.roomViewStore.getRoomId();

        // TODO to implement for sections
        // Apply sticky room logic to keep selected room at same position
        //const stickyRooms = this.applyStickyRoom(isRoomChange, roomId);

        // Update roomsResult with sticky rooms
        // this.roomsResult = {
        //     ...this.roomsResult,
        //     rooms: stickyRooms,
        // };

        // Rebuild roomsMap with the reordered rooms
        this.updateRoomsMap(this.roomsResult);

        // Calculate the active room index after applying sticky logic
        const activeRoomIndex = this.getActiveRoomIndex(roomId);

        // Track the current active room index for future sticky calculations
        this.lastActiveRoomIndex = activeRoomIndex;

        // Build the complete state atomically to ensure consistency
        // roomIds and roomListState must always be in sync
        const { sections, isFlatList } = computeSections(
            this.roomsResult,
            (tag) => this.roomSectionHeaderViewModels.get(tag)?.isExpanded ?? true,
        );

        // Update filter keys - only update if they have actually changed to prevent unnecessary re-renders of the room list
        const previousFilterKeys = this.snapshot.current.roomListState.filterKeys;
        const newFilterKeys = this.roomsResult.filterKeys?.map((k) => String(k));
        const roomListState: RoomListViewState = {
            activeRoomIndex,
            spaceId: this.roomsResult.spaceId,
            filterKeys: keepIfSame(previousFilterKeys, newFilterKeys),
        };

        const activeFilterId = this.activeFilter !== undefined ? filterKeyToIdMap.get(this.activeFilter) : undefined;
        const isRoomListEmpty = this.roomsResult.sections.every((section) => section.rooms.length === 0);
        const isLoadingRooms = RoomListStoreV3.instance.isLoadingRooms;

        // Single atomic snapshot update
        this.snapshot.merge({
            isLoadingRooms,
            isRoomListEmpty,
            activeFilterId,
            roomListState,
            sections,
            isFlatList,
        });
    }

    public createChatRoom = (): void => {
        dispatcher.fire(Action.CreateChat);
    };

    public createRoom = (): void => {
        const activeSpace = SpaceStore.instance.activeSpaceRoom;
        if (activeSpace) {
            dispatcher.dispatch({
                action: Action.CreateRoom,
                parent_space: activeSpace,
            });
        } else {
            dispatcher.dispatch({
                action: Action.CreateRoom,
            });
        }
    };
}

/**
 * Compute the sections to display in the room list based on the rooms result and section expansion state.
 * @param roomsResult - The current rooms result containing sections and rooms
 * @param isSectionExpanded - A function that takes a section tag and returns whether that section is currently expanded
 * @returns An object containing the computed sections with room IDs (empty if section is collapsed) and a boolean indicating if the list should be displayed as a flat list (only one section with all rooms)
 */
function computeSections(
    roomsResult: RoomsResult,
    isSectionExpanded: (tag: string) => boolean,
): { sections: RoomListSection[]; isFlatList: boolean } {
    const sections = roomsResult.sections
        .map(({ tag, rooms }) => ({
            id: tag,
            roomIds: rooms.map((room) => room.roomId),
        }))
        // Only include sections that have rooms
        .filter((section) => section.roomIds.length > 0)
        // Remove roomIds for sections that are currently collapsed according to their section header view model
        .map((section) => ({
            ...section,
            roomIds: isSectionExpanded(section.id) ? section.roomIds : [],
        }));
    const isFlatList = sections.length === 1 && sections[0].id === CHATS_TAG;

    return { sections, isFlatList };
}
