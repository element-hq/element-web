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
    type Section,
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

/**
 * Tracks the position of the active room within a specific section.
 * Used to implement sticky room behaviour so the selected room doesn't
 * jump around when the room list is re-sorted.
 */
interface StickyRoomPosition {
    /** The tag of the section the room belongs to. */
    sectionTag: string;
    /** The index of the room within that section. */
    indexInSection: number;
}

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
    /**
     * List of sections to display in the room list, derived from roomsResult and section header view model expansion state.
     */
    private sections: Section[] = [];
    private lastActiveRoomPosition: StickyRoomPosition | undefined = undefined;

    // Child view model management
    private readonly roomItemViewModels = new Map<string, RoomListItemViewModel>();
    // This map is intentionally additive (never cleared except on space changes) to avoid a race condition:
    // a list update can refresh roomsResult and roomsMap before the view re-renders, so the view may still
    // request a view model for a room that was removed from the latest list. Keeping old entries prevents a crash.
    private roomsMap = new Map<string, Room>();
    // Don't clear section vm because we want to keep the expand/collapse state even during space changes.
    private readonly roomSectionHeaderViewModels = new Map<string, RoomListSectionHeaderViewModel>();

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
            sections: toRoomListSection(sections),
            canCreateRoom,
        });

        this.roomsResult = roomsResult;
        this.sections = sections;

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

        // When a filter is toggled on, expand sections that have results so they're visible
        if (newFilter) {
            for (const section of this.roomsResult.sections) {
                if (section.rooms.length > 0) {
                    const sectionHeaderVM = this.roomSectionHeaderViewModels.get(section.tag);
                    if (sectionHeaderVM) sectionHeaderVM.isExpanded = true;
                }
            }
        }

        this.updateRoomListData();
    };

    /**
     * Add rooms from the RoomsResult to the roomsMap for quick lookup.
     * This does not clear the roomsMap.
     * This maintains a quick lookup for room objects.
     */
    private updateRoomsMap(roomsResult: RoomsResult): void {
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
    public getRoomItemViewModel(roomId: string): RoomListItemViewModel | undefined {
        // Check if we have a view model for this room
        let viewModel = this.roomItemViewModels.get(roomId);

        if (!viewModel) {
            let room = this.roomsMap.get(roomId);
            if (!room) {
                // Maybe the roomsMap is out of date due to a recent roomsResult change that hasn't been applied yet (race condition)
                this.updateRoomsMap(this.roomsResult);
                room = this.roomsMap.get(roomId);
            }

            if (!room) {
                // Race condition: the room list has changed but the view hasn't re-rendered yet.
                // Return undefined so the view can skip rendering this item.
                return undefined;
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
            spaceId: this.roomsResult.spaceId,
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
        const rooms = this.sections.flatMap((section) => section.rooms);

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
        const newSpaceId = this.roomsResult.spaceId;

        // Detect space change
        if (oldSpaceId !== newSpaceId) {
            // Clear view models when the space changes
            // We only want to do this on space changes, not on regular list updates, to preserve view models when possible
            // The view models are disposed when scrolling out of view (handled by updateVisibleRooms)
            this.clearViewModels();
            // Clear roomsMap to prevent stale room data - it will be repopulated with the new roomsResult
            this.roomsMap.clear();

            this.updateRoomsMap(this.roomsResult);

            // Restore the expanded/collapsed state for the new space
            for (const viewModel of this.roomSectionHeaderViewModels.values()) {
                viewModel.setSpace(newSpaceId);
            }

            // Space changed - get the last selected room for the new space to prevent flicker
            const lastSelectedRoom = SpaceStore.instance.getLastSelectedRoomIdForSpace(newSpaceId);

            this.updateRoomListData(true, lastSelectedRoom);
            return;
        }

        this.updateRoomsMap(this.roomsResult);

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

        const index = this.sections.flatMap((section) => section.rooms).findIndex((room) => room.roomId === roomId);
        return index >= 0 ? index : undefined;
    }

    /**
     * Find the position of a room within the sections list.
     * Returns undefined if the room is not found.
     */
    private findRoomPosition(sections: Section[], roomId: string): StickyRoomPosition | undefined {
        for (const section of sections) {
            const idx = section.rooms.findIndex((room) => room.roomId === roomId);
            if (idx !== -1) return { sectionTag: section.tag, indexInSection: idx };
        }
        return undefined;
    }

    /**
     * Apply sticky room logic to keep the active room at the same position within its section.
     * When the room list updates, this prevents the selected room from jumping around in the UI.
     *
     * @param isRoomChange - Whether this update is due to a room change (not a list update)
     * @param roomId - The room ID to apply sticky logic for (can be null/undefined)
     * @returns The modified sections array with sticky positioning applied
     */
    private applyStickyRoom(isRoomChange: boolean, roomId: string | null | undefined): Section[] {
        const sections = this.roomsResult.sections;

        // When opening another room, the index should obviously change
        if (!roomId || isRoomChange) return sections;

        // If there was no previously tracked position, nothing to stick to
        const oldPosition = this.lastActiveRoomPosition;
        if (!oldPosition) return sections;

        const newPosition = this.findRoomPosition(sections, roomId);

        // If the room is no longer in the list, nothing to do
        if (!newPosition) return sections;

        // If the room moved to a different section, this is an intentional structural
        // change (e.g. favourited/unfavourited), so don't apply sticky logic
        if (newPosition.sectionTag !== oldPosition.sectionTag) return sections;

        // If the index within the section hasn't changed, nothing to do
        if (newPosition.indexInSection === oldPosition.indexInSection) return sections;

        // Find the target section and apply the sticky swap within it
        return sections.map((section) => {
            // Different section - no change
            if (section.tag !== oldPosition.sectionTag) return section;

            const sectionRooms = section.rooms;

            // If the old index falls out of the bounds of the section
            // (usually because rooms were removed), we can no longer place
            // the active room in the same old position
            if (oldPosition.indexInSection > sectionRooms.length - 1) {
                return section;
            }

            // Making the active room sticky is as simple as removing it from
            // its new index and placing it in the old index within the section
            const newRooms = [...sectionRooms];
            const [stickyRoom] = newRooms.splice(newPosition.indexInSection, 1);
            newRooms.splice(oldPosition.indexInSection, 0, stickyRoom);

            return { ...section, rooms: newRooms };
        });
    }

    private async updateRoomListData(
        isRoomChange: boolean = false,
        roomIdOverride: string | null = null,
    ): Promise<void> {
        // Determine the room ID to use for calculations
        // Use override if provided (e.g., during space changes), otherwise fall back to RoomViewStore
        const roomId = roomIdOverride ?? SdkContextClass.instance.roomViewStore.getRoomId();

        // Apply sticky room logic to keep selected room at same position within its section
        const stickySections = this.applyStickyRoom(isRoomChange, roomId);

        // Update roomsResult with the sticky-adjusted sections
        this.roomsResult = {
            ...this.roomsResult,
            sections: stickySections,
        };

        // Rebuild roomsMap with the reordered rooms
        this.updateRoomsMap(this.roomsResult);

        // Track the current active room position for future sticky calculations
        this.lastActiveRoomPosition = roomId ? this.findRoomPosition(this.roomsResult.sections, roomId) : undefined;

        // Update section header view models with current rooms for unread state tracking
        for (const section of this.roomsResult.sections) {
            this.getSectionHeaderViewModel(section.tag).setRooms(section.rooms);
        }

        // Build the complete state atomically to ensure consistency
        const { sections, isFlatList } = computeSections(
            this.roomsResult,
            (tag) => this.roomSectionHeaderViewModels.get(tag)?.isExpanded ?? true,
        );
        // If it's a flat list, we need to make sure the single section is expanded and has all rooms, otherwise the room list will be empty
        if (isFlatList) {
            const chatSections = this.roomSectionHeaderViewModels.get(CHATS_TAG);
            if (chatSections) chatSections.isExpanded = true;
            chatSections?.setRooms(this.roomsResult.sections.flatMap((section) => section.rooms));
        }
        this.sections = sections;

        // Calculate the active room index from the computed sections (which exclude collapsed sections' rooms)
        const activeRoomIndex = this.getActiveRoomIndex(roomId);

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

        const viewSections = toRoomListSection(this.sections);
        const previousSections = this.snapshot.current.sections;

        // Single atomic snapshot update
        this.snapshot.merge({
            isLoadingRooms,
            isRoomListEmpty,
            activeFilterId,
            roomListState: keepIfSame(this.snapshot.current.roomListState, roomListState),
            sections: keepIfSame(previousSections, viewSections),
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
 * @returns An object containing the computed sections (with rooms removed for collapsed sections) and a boolean indicating if this is a flat list (only one section with all rooms)
 */
function computeSections(
    roomsResult: RoomsResult,
    isSectionExpanded: (tag: string) => boolean,
): { sections: Section[]; isFlatList: boolean } {
    const sections = roomsResult.sections
        // Only include sections that have rooms
        .filter((section) => section.rooms.length > 0)
        // Remove roomIds for sections that are currently collapsed according to their section header view model
        .map((section) => ({
            ...section,
            rooms: isSectionExpanded(section.tag) ? section.rooms : [],
        }));
    const isFlatList = sections.length === 1 && sections[0].tag === CHATS_TAG;

    return { sections, isFlatList };
}

/**
 * Convert from the internal Section type used in the view model to the RoomListSection type used in the snapshot.
 */
function toRoomListSection(sections: Section[]): RoomListSection[] {
    return sections.map(({ tag, rooms }) => ({
        id: tag,
        roomIds: rooms.map((room) => room.roomId),
    }));
}
