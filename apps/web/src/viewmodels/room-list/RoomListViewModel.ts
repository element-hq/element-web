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
    type ToastType,
} from "@element-hq/web-shared-components";
import { type Room, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { Action } from "../../dispatcher/actions";
import dispatcher from "../../dispatcher/dispatcher";
import { type ViewRoomDeltaPayload } from "../../dispatcher/payloads/ViewRoomDeltaPayload";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { type RoomListSectionsCollapseStateChangedPayload } from "../../dispatcher/payloads/RoomListSectionsCollapseStateChangedPayload";
import { type SpaceStoreClass } from "../../stores/spaces/SpaceStore";
import RoomListStoreV3, {
    RoomListStoreV3Event,
    type RoomsResult,
    type Section,
} from "../../stores/room-list-v3/RoomListStoreV3";
import { FilterEnum } from "../../stores/room-list-v3/skip-list/filters";
import {
    RoomNotificationStateStore,
    UPDATE_STATUS_INDICATOR,
} from "../../stores/notifications/RoomNotificationStateStore";
import { RoomListItemViewModel } from "./RoomListItemViewModel";
import { hasCreateRoomRights } from "./utils";
import { keepIfSame } from "../../utils/keepIfSame";
import { DefaultTagID } from "../../stores/room-list-v3/skip-list/tag";
import { RoomListSectionHeaderViewModel } from "./RoomListSectionHeaderViewModel";
import { getCustomSectionData, isCustomSectionTag, CHATS_TAG } from "../../stores/room-list-v3/section";
import { tagRoom } from "../../utils/room/tagRoom";
import { getSectionTagForRoom } from "../../utils/room/getSectionTagForRoom";
import SettingsStore from "../../settings/SettingsStore";
import { type RoomViewStore } from "../../stores/RoomViewStore.tsx";

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
    roomViewStore: RoomViewStore;
    spaceStore: SpaceStoreClass;
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

/**
 * Filters that are redundant when sections are enabled: Favourites and Low Priority rooms
 * already have their own sections, so these filters are only shown as chips when sectioning
 * is disabled (see {@link getVisibleFilterIds}).
 */
const SECTION_ONLY_FILTER_IDS: ReadonlySet<FilterId> = new Set<FilterId>(["favourite", "low_priority"]);

/**
 * Compute the filter ids to display as primary filter chips.
 * When sections are enabled, the Favourites and Low Priority filters are hidden because those
 * rooms are surfaced as dedicated sections instead.
 */
function getVisibleFilterIds(): FilterId[] {
    const areSectionsEnabled = SettingsStore.getValue("RoomList.showSections");
    const filterIds = [...filterKeyToIdMap.values()];
    return areSectionsEnabled ? filterIds.filter((id) => !SECTION_ONLY_FILTER_IDS.has(id)) : filterIds;
}

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
    /**
     * When dragging sections, we want to temporarily expand all sections to make it easier to move rooms between sections.
     * This map stores the original expansion state of each section before the drag starts, so we can restore it after the drag ends.
     */
    private readonly savedExpansionStates = new Map<string, boolean>();

    /**
     * Reference to the currently displayed event toast's auto-close timer, used to dismiss it
     * after a timeout (see {@link showToast}).
     */
    private toastRef?: number;

    /**
     * The currently active transient event toast ("section_created" / "chat_moved"), if any.
     * Distinct from the derived "unread_activity" toast: this is set imperatively by an event
     * and auto-dismisses, whereas unread activity is recomputed from list/notification state.
     * {@link recomputeToast} reconciles the two into the single {@link RoomListViewSnapshot.toast}.
     */
    private eventToast?: ToastType;

    /**
     * Whether there is currently unread activity (a notification count) in a room scrolled below
     * the visible area of the list. Recomputed by {@link updateUnreadActivityBelow}; surfaced as
     * the "unread_activity" toast by {@link recomputeToast} when no event toast takes precedence.
     */
    private hasUnreadActivityBelow = false;

    /**
     * The last genuinely-visible index reported by the virtualized list (excluding the
     * rendered overscan buffer), in the list's own entry space (room indices for a flat
     * list; including a slot per section header for a grouped list). Initialised to -1 so
     * that nothing is considered "below the fold" until the view reports the fold.
     */
    private foldIndex = -1;

    /**
     * Imperative scroll handle registered by the view (see {@link setScrollToIndex}). The view
     * owns the virtualized list's scroll handle, so it provides this; we call it to scroll a
     * given item index into view in response to user actions.
     */
    private scrollToIndex?: (index: number) => void;

    public constructor(props: RoomListViewModelProps) {
        const activeSpace = props.spaceStore.activeSpaceRoom;

        // Get initial rooms
        const roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(undefined);
        const canCreateRoom = hasCreateRoomRights(props.client, activeSpace);

        const filterIds = getVisibleFilterIds();

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

        // Subscribe to section creation
        this.disposables.trackListener(
            RoomListStoreV3.instance,
            RoomListStoreV3Event.SectionCreated as any,
            this.onSectionCreated as (...args: unknown[]) => void,
        );

        // Subscribe to room tagging
        this.disposables.trackListener(
            RoomListStoreV3.instance,
            RoomListStoreV3Event.RoomTagged as any,
            this.onRoomTagged,
        );

        // Recompute the "unread activity below" toast when room notification state
        // changes (e.g. a room below the fold becomes unread, or is marked read).
        this.disposables.trackListener(
            RoomNotificationStateStore.instance,
            UPDATE_STATUS_INDICATOR as any,
            this.updateUnreadActivityBelow,
        );

        // Subscribe to active room changes to update selected room
        const dispatcherRef = dispatcher.register(this.onDispatch);
        this.disposables.track(() => {
            dispatcher.unregister(dispatcherRef);
        });

        // Recompute the lis when setting changes
        const showSectionsRef = SettingsStore.watchSetting("RoomList.showSections", null, this.onShowSectionsChange);
        this.disposables.track(() => SettingsStore.unwatchSetting(showSectionsRef));

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
     * Handle changes to the {@link RoomList.showSections} setting.
     * Toggling sections is a rare action, so we simply reset the filters and rebuild
     * the list from scratch rather than trying to reconcile the previous state.
     */
    private readonly onShowSectionsChange = (): void => {
        this.activeFilter = undefined;
        this.clearViewModels();
        this.roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace();
        this.updateRoomsMap(this.roomsResult);
        this.snapshot.merge({ filterIds: getVisibleFilterIds() });
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

        const title = TAG_TO_TITLE_MAP[tag] || (isCustomSectionTag(tag) && getCustomSectionData()[tag]?.name) || tag;
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
     *
     * Indices are in room-index space (section header entries excluded):
     * startIndex is inclusive, endIndex is exclusive.
     */
    public updateVisibleRooms(startIndex: number, endIndex: number): void {
        const allRoomIds = this.roomIds;
        const newVisibleIds = allRoomIds.slice(startIndex, endIndex);

        const newVisibleSet = new Set(newVisibleIds);

        // Dispose view models for rooms no longer visible
        for (const [roomId, viewModel] of this.roomItemViewModels.entries()) {
            if (!newVisibleSet.has(roomId)) {
                viewModel.dispose();
                this.roomItemViewModels.delete(roomId);
            }
        }

        // The rendered range changed, so re-evaluate whether unread activity is below the fold.
        this.updateUnreadActivityBelow();
    }

    /**
     * Update the last genuinely-visible item index (excluding the rendered overscan
     * buffer), reported by the view from the scroller geometry. This is what the
     * "unread activity" toast uses to decide what is below the fold, so that the toast
     * appears as soon as an unread room scrolls just out of view rather than only once
     * it leaves the overscan buffer.
     */
    public updateVisibleFold = (visibleEndIndex: number): void => {
        if (this.foldIndex === visibleEndIndex) return;
        this.foldIndex = visibleEndIndex;
        this.updateUnreadActivityBelow();
    };

    /**
     * Find the first room with an unread-message notification (a count badge — the green or
     * red decoration, not just the unread-activity dot) positioned below the visible area.
     *
     * "Below the fold" is determined from the last visible index reported by the
     * virtualized list (see {@link updateVisibleRooms}). For a grouped list the
     * virtualized list interleaves a section-header entry before each section's
     * rooms, so we walk the rooms in the same entry order the view renders and
     * compare against that index space.
     *
     * Collapsed sections render only their header (their rooms are removed from the
     * displayed sections), so their notifying rooms are not directly reachable. When a
     * collapsed section's header is itself below the fold and the section contains a
     * notifying room, we surface the header as the target so clicking the toast scrolls
     * it into view (revealing the header's aggregated notification badge).
     *
     * @returns The next notifying room below the fold, or undefined if there is none
     *          (or the view has not yet reported a visible range).
     */
    private firstUnreadRoomBelowFold(): { room: Room; index: number } | undefined {
        if (this.foldIndex < 0) return undefined;

        // Only surface rooms showing a notification badge (a count/symbol — the green or red
        // decoration), not rooms with just the unread-activity dot.
        const hasNotification = (room: Room): boolean =>
            RoomNotificationStateStore.instance.getRoomState(room).hasUnreadCount;

        if (this.snapshot.current.isFlatList) {
            // Flat list: virtualized indices map 1:1 to rooms.
            const rooms = this.sections.flatMap((section) => section.rooms);
            for (let i = this.foldIndex + 1; i < rooms.length; i++) {
                if (hasNotification(rooms[i])) return { room: rooms[i], index: i };
            }
            return undefined;
        }

        // Full (pre-collapse) rooms per section tag, so we can detect unreads hidden inside
        // collapsed sections whose displayed rooms have been emptied.
        const fullRoomsByTag = new Map(this.roomsResult.sections.map((section) => [section.tag, section.rooms]));

        // Grouped list: each section contributes a header entry followed by its rooms, so the
        // index we return is in the virtualized list's entry space (matching scrollIntoView).
        let entryIndex = -1;
        for (const section of this.sections) {
            entryIndex++; // section header entry

            const isExpanded = this.roomSectionHeaderViewModels.get(section.tag)?.isExpanded ?? true;
            if (!isExpanded) {
                // Collapsed: rooms aren't rendered, so the header is the only entry. If it is
                // below the fold and hides an unread room, target the header itself.
                if (entryIndex > this.foldIndex) {
                    const notifyingRoom = (fullRoomsByTag.get(section.tag) ?? []).find(hasNotification);
                    if (notifyingRoom) return { room: notifyingRoom, index: entryIndex };
                }
                continue;
            }

            for (const room of section.rooms) {
                entryIndex++; // this room's entry
                if (entryIndex > this.foldIndex && hasNotification(room)) return { room, index: entryIndex };
            }
        }
        return undefined;
    }

    /**
     * Recompute whether there is unread activity below the visible area, reconciling the
     * displayed toast if it changed.
     */
    private updateUnreadActivityBelow = (): void => {
        const hasUnreadActivityBelow = this.firstUnreadRoomBelowFold() !== undefined;
        if (this.hasUnreadActivityBelow === hasUnreadActivityBelow) return;
        this.hasUnreadActivityBelow = hasUnreadActivityBelow;
        this.recomputeToast();
    };

    /**
     * Register (or clear) the view's imperative scroll handler. Called by the view on mount
     * since it owns the virtualized list's scroll handle.
     */
    public setScrollToIndex = (scrollToIndex: ((index: number) => void) | undefined): void => {
        this.scrollToIndex = scrollToIndex;
    };

    /**
     * Scroll the next unread room below the visible area of the list into view (without opening
     * it). Invoked when the user clicks the "unread activity" toast.
     */
    public scrollToUnreadActivity = (): void => {
        const target = this.firstUnreadRoomBelowFold();
        if (target) this.scrollToIndex?.(target.index);
    };

    /**
     * Scroll a room into view, expanding its section first if it is collapsed so the tile can
     * actually be shown.
     */
    private async scrollRoomIntoView(roomId: string): Promise<void> {
        // Look in the full (pre-collapse) sections so we can find rooms hidden in collapsed sections.
        const section = this.roomsResult.sections.find((s) => s.rooms.some((room) => room.roomId === roomId));
        // Room not found
        if (!section) return;

        const headerViewModel = this.roomSectionHeaderViewModels.get(section.tag);
        // Expand and rebuild the section
        if (headerViewModel && !headerViewModel.isExpanded) {
            headerViewModel.isExpanded = true;
            await this.updateRoomListData();
        }

        // Scroll to the room
        const index = this.getRoomEntryIndex(roomId);
        if (index !== undefined) this.scrollToIndex?.(index);
    }

    /**
     * Compute a room's index in the list's entry space, or undefined if it is not in the displayed
     * sections (e.g. collapsed or filtered out). Flat list: the room index; grouped list: includes
     * one slot per section header (matching {@link firstUnreadRoomBelowFold}).
     */
    private getRoomEntryIndex(roomId: string): number | undefined {
        // A grouped list renders a header entry before each section's rooms; a flat list does not.
        const hasSectionHeaders = !this.snapshot.current.isFlatList;

        let entryIndex = 0;
        for (const section of this.sections) {
            if (hasSectionHeaders) entryIndex++; // section header entry
            const indexInSection = section.rooms.findIndex((room) => room.roomId === roomId);
            if (indexInSection !== -1) return entryIndex + indexInSection;
            entryIndex += section.rooms.length;
        }
        return undefined;
    }

    private onDispatch = async (payload: any): Promise<void> => {
        if (payload.action === Action.ActiveRoomChanged) {
            // When the active room changes, update the room list data to reflect the new selected room
            // Pass isRoomChange=true so sticky logic doesn't prevent the index from updating
            this.updateRoomListData(true);
        } else if (payload.action === Action.ViewRoomDelta) {
            // Handle keyboard navigation shortcuts (Alt+ArrowUp/Down)
            // This was previously handled by useRoomListNavigation hook
            this.handleViewRoomDelta(payload as ViewRoomDeltaPayload);
        } else if (payload.action === Action.ViewRoom && payload.show_room_tile && payload.room_id) {
            await this.scrollRoomIntoView(payload.room_id);
        } else if (payload.action === Action.RoomListCollapseAllSections) {
            this.onCollapseAllSections(false);
        } else if (payload.action === Action.RoomListExpandAllSections) {
            this.onCollapseAllSections(true);
        }
    };

    /**
     * Handles the collapse or expansion of all sections in the room list.
     * @param expand - Whether to expand or collapse all sections
     */
    private onCollapseAllSections(expand: boolean): void {
        for (const sectionHeaderVM of this.roomSectionHeaderViewModels.values()) {
            sectionHeaderVM.isExpanded = expand;
        }
        this.updateRoomListData();
    }

    /**
     * Handle keyboard navigation shortcuts (Alt+ArrowUp/Down) to move between rooms.
     * Supports both regular navigation and unread-only navigation.
     * Migrated from useRoomListNavigation hook.
     */
    private handleViewRoomDelta(payload: ViewRoomDeltaPayload): void {
        const currentRoomId = this.props.roomViewStore.getRoomId();
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
            const lastSelectedRoom = this.props.spaceStore.getLastSelectedRoomIdForSpace(newSpaceId);

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
        scrollToSectionTag: string | undefined = undefined,
    ): Promise<void> {
        // Determine the room ID to use for calculations
        // Use override if provided (e.g., during space changes), otherwise fall back to RoomViewStore
        const roomId = roomIdOverride ?? this.props.roomViewStore.getRoomId();

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
        const viewSections = toRoomListSection(this.sections);

        const resolvedScrollToSectionTag =
            scrollToSectionTag && viewSections.some((s) => s.id === scrollToSectionTag)
                ? scrollToSectionTag
                : undefined;

        const roomListState: RoomListViewState = {
            activeRoomIndex,
            spaceId: this.roomsResult.spaceId,
            filterKeys: keepIfSame(previousFilterKeys, newFilterKeys),
            scrollToSectionTag: resolvedScrollToSectionTag,
        };

        const activeFilterId = this.activeFilter !== undefined ? filterKeyToIdMap.get(this.activeFilter) : undefined;
        const isRoomListEmpty = this.roomsResult.sections.every((section) => section.rooms.length === 0);
        const isLoadingRooms = RoomListStoreV3.instance.isLoadingRooms;
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

        this.notifyCollapseState(isFlatList);

        // Room list / sections changed: re-evaluate the unread-activity toast.
        this.updateUnreadActivityBelow();
    }

    /**
     * Notify the dispatcher about the current collapse state of the room list sections.
     * @param isFlatList - Whether the room list is currently displayed as a flat list
     */
    private notifyCollapseState(isFlatList: boolean): void {
        // Hide collapse/expand all button if it's a flat list
        if (isFlatList) {
            dispatcher.dispatch<RoomListSectionsCollapseStateChangedPayload>({
                action: Action.RoomListSectionsCollapseStateChanged,
                collapseSections: undefined,
            });
            return;
        }

        // Determine if all sections are currently collapsed
        const allCollapsed = this.snapshot.current.sections.every(
            ({ id }) => !(this.roomSectionHeaderViewModels.get(id)?.isExpanded ?? true),
        );
        dispatcher.dispatch<RoomListSectionsCollapseStateChangedPayload>({
            action: Action.RoomListSectionsCollapseStateChanged,
            collapseSections: allCollapsed ? "collapse" : "expand",
        });
    }

    public createChatRoom = (): void => {
        dispatcher.fire(Action.CreateChat);
    };

    public createRoom = (): void => {
        const activeSpace = this.props.spaceStore.activeSpaceRoom;
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

    public onSectionCreated = (tag: string): void => {
        // Refresh roomsResult so the new section lands in the same snapshot as the scroll-to.
        const filterKeys = this.activeFilter !== undefined ? [this.activeFilter] : undefined;
        this.roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filterKeys);
        this.updateRoomsMap(this.roomsResult);
        this.updateRoomListData(false, null, tag);
        this.showToast("section_created");
    };

    public onRoomTagged = (): void => {
        const areSectionsEnabled = SettingsStore.getValue("RoomList.showSections");
        // Only show the "chat moved" toast if sections are enabled
        if (!areSectionsEnabled) return;

        this.showToast("chat_moved");
    };

    public closeToast: () => void = () => {
        clearTimeout(this.toastRef);
        this.eventToast = undefined;
        this.recomputeToast();
    };

    private showToast(toast: ToastType): void {
        clearTimeout(this.toastRef);
        this.eventToast = toast;
        this.recomputeToast();
        // Automatically close the toast after 15 seconds
        this.toastRef = setTimeout(() => {
            this.closeToast();
        }, 15 * 1000);
    }

    /**
     * Reconcile the single toast shown by the view from the two independent sources: the
     * transient event toast (which takes precedence and auto-dismisses) and the derived
     * unread-activity state. The snapshot is only updated when the effective toast changes,
     * to avoid unnecessary re-renders.
     */
    private recomputeToast(): void {
        const toast = this.eventToast ?? (this.hasUnreadActivityBelow ? "unread_activity" : undefined);
        if (this.snapshot.current.toast !== toast) {
            this.snapshot.merge({ toast });
        }
    }

    public changeSectionOrder = async (sourceTag: string, targetTag: string): Promise<void> => {
        await RoomListStoreV3.instance.reorderSection(sourceTag, targetTag);
        // Scroll to the section after it moved
        const filterKeys = this.activeFilter !== undefined ? [this.activeFilter] : undefined;
        this.roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filterKeys);
        this.updateRoomsMap(this.roomsResult);
        this.updateRoomListData(false, null, sourceTag);
    };

    public onSectionDragStart = (): void => {
        this.savedExpansionStates.clear();
        for (const [tag, sectionVM] of this.roomSectionHeaderViewModels) {
            this.savedExpansionStates.set(tag, sectionVM.isExpanded);
            sectionVM.isExpanded = false;
        }
        this.updateRoomListData();
    };

    public onSectionDragEnd = (): void => {
        for (const [tag, expanded] of this.savedExpansionStates) {
            const sectionVM = this.roomSectionHeaderViewModels.get(tag);
            if (sectionVM) sectionVM.isExpanded = expanded;
        }
        this.savedExpansionStates.clear();
        this.updateRoomListData();
    };

    public changeRoomSection = (roomId: string, tag: string): void => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;

        const currentTag = getSectionTagForRoom(room);
        // Room is already in the section
        if (currentTag === tag) return;

        tagRoom(room, tag);
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
    const customSections = getCustomSectionData();

    const sections = roomsResult.sections
        // Only include sections that have rooms, or custom sections that were created in the current space.
        .filter(
            (section) =>
                section.rooms.length > 0 ||
                (isCustomSectionTag(section.tag) && customSections[section.tag]?.spaceId === roomsResult.spaceId),
        )
        // Remove roomIds for sections that are currently collapsed according to their section header view model
        .map((section) => ({
            ...section,
            rooms: isSectionExpanded(section.tag) ? section.rooms : [],
        }));
    const isFlatList = sections.length === 0 || (sections.length === 1 && sections[0].tag === CHATS_TAG);

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
