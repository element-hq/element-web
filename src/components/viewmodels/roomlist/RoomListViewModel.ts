/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    BaseViewModel,
    type RoomListSnapshot,
    type RoomListHeaderState,
    type SpaceMenuState,
    type ComposeMenuState,
    type Filter,
    type RoomListItem,
    type RoomNotifState,
    type RoomListViewActions,
    SortOption,
    type RoomListViewState,
} from "@element-hq/web-shared-components";
import {
    type MatrixClient,
    type Room,
    RoomEvent,
    JoinRule,
    RoomType,
} from "matrix-js-sdk/src/matrix";

import { _t, _td, type TranslationKey } from "../../../languageHandler";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { MetaSpace, getMetaSpaceName, UPDATE_HOME_BEHAVIOUR, UPDATE_SELECTED_SPACE } from "../../../stores/spaces";
import { Action } from "../../../dispatcher/actions";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import dispatcher from "../../../dispatcher/dispatcher";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { type ViewRoomDeltaPayload } from "../../../dispatcher/payloads/ViewRoomDeltaPayload";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../../LegacyCallHandler";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import {
    shouldShowSpaceSettings,
    showSpaceInvite,
    showSpacePreferences,
    showSpaceSettings,
    showCreateNewRoom,
} from "../../../utils/space";
import SettingsStore from "../../../settings/SettingsStore";
import RoomListStoreV3, { RoomListStoreV3Event, type RoomsResult } from "../../../stores/room-list-v3/RoomListStoreV3";
import { SortingAlgorithm } from "../../../stores/room-list-v3/skip-list/sorters";
import { FilterKey } from "../../../stores/room-list-v3/skip-list/filters";
import { RoomNotificationStateStore, UPDATE_STATUS_INDICATOR } from "../../../stores/notifications/RoomNotificationStateStore";
import { MessagePreviewStore } from "../../../stores/room-list/MessagePreviewStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { DefaultTagID } from "../../../stores/room-list/models";
import { clearRoomNotification, setMarkedUnreadState } from "../../../utils/notifications";
import { tagRoom } from "../../../utils/room/tagRoom";
import DMRoomMap from "../../../utils/DMRoomMap";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { hasAccessToNotificationMenu, hasAccessToOptionsMenu, hasCreateRoomRights, createRoom as createRoomFunc } from "./utils";
import { EchoChamber } from "../../../stores/local-echo/EchoChamber";
import { RoomNotifState as ElementRoomNotifState } from "../../../RoomNotifs";
import { SdkContextClass } from "../../../contexts/SDKContext";

interface RoomListViewModelProps {
    client: MatrixClient;
}

const filterKeyToNameMap: Map<FilterKey, TranslationKey> = new Map([
    [FilterKey.UnreadFilter, _td("room_list|filters|unread")],
    [FilterKey.PeopleFilter, _td("room_list|filters|people")],
    [FilterKey.RoomsFilter, _td("room_list|filters|rooms")],
    [FilterKey.FavouriteFilter, _td("room_list|filters|favourite")],
    [FilterKey.MentionsFilter, _td("room_list|filters|mentions")],
    [FilterKey.InvitesFilter, _td("room_list|filters|invites")],
    [FilterKey.LowPriorityFilter, _td("room_list|filters|low_priority")],
]);

/**
 * Consolidated ViewModel for the entire RoomListPanel component.
 * Manages search, header, filters, and room list state in a single class.
 * Implements RoomListViewActions to provide room action callbacks.
 */
export class RoomListViewModel
    extends BaseViewModel<RoomListSnapshot, RoomListViewModelProps>
    implements RoomListViewActions
{
    // State tracking
    private activeSpace: Room | null = null;
    private displayRoomSearch: boolean;
    private activeFilter: FilterKey | undefined = undefined;
    private roomsResult: RoomsResult;

    // Search state properties (not in snapshot)
    public showDialPad: boolean = false;
    public showExplore: boolean = false;

    public constructor(props: RoomListViewModelProps) {
        const displayRoomSearch = shouldShowComponent(UIComponent.FilterContainer);
        const activeSpace = SpaceStore.instance.activeSpaceRoom;

        // Get initial rooms
        const roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(undefined);

        super(props, {
            headerState: RoomListViewModel.createHeaderState(
                SpaceStore.instance.activeSpace,
                activeSpace,
                SpaceStore.instance.allRoomsInHome,
                props.client,
            ),
            // Initial view state
            isLoadingRooms: RoomListStoreV3.instance.isLoadingRooms,
            isRoomListEmpty: roomsResult.rooms.length === 0,
            filters: RoomListViewModel.createFilters(undefined),
            roomListState: RoomListViewModel.createRoomListState(roomsResult, props.client),
        });

        this.displayRoomSearch = displayRoomSearch;
        this.activeSpace = activeSpace;
        this.roomsResult = roomsResult;

        // Initialize search state
        this.showDialPad = LegacyCallHandler.instance.getSupportsPstnProtocol() ?? false;
        this.showExplore = SpaceStore.instance.activeSpace === MetaSpace.Home && shouldShowComponent(UIComponent.ExploreRooms);

        // Subscribe to search-related changes if search is enabled
        if (this.displayRoomSearch) {
            this.disposables.trackListener(
                LegacyCallHandler.instance,
                LegacyCallHandlerEvent.ProtocolSupport,
                this.onProtocolChanged,
            );
        }

        // Subscribe to space changes
        this.disposables.trackListener(SpaceStore.instance, UPDATE_SELECTED_SPACE as any, this.onSpaceChanged);
        this.disposables.trackListener(SpaceStore.instance, UPDATE_HOME_BEHAVIOUR as any, this.onHomeBehaviourChanged);

        // Subscribe to room name changes if there's an active space
        if (this.activeSpace) {
            this.disposables.trackListener(this.activeSpace, RoomEvent.Name, this.onRoomNameChanged);
        }

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

        // Subscribe to notification state changes
        this.disposables.trackListener(
            RoomNotificationStateStore.instance,
            UPDATE_STATUS_INDICATOR as any,
            this.onNotificationUpdate,
        );

        // Subscribe to message preview changes
        this.disposables.trackListener(
            MessagePreviewStore.instance,
            UPDATE_EVENT,
            this.onMessagePreviewUpdate,
        );

        // Subscribe to dispatcher for keyboard navigation
    const dispatcherRef = dispatcher.register(this.onDispatch);
    this.disposables.track(() => {
        dispatcher.unregister(dispatcherRef);
    });
    }    // ==================== Search Actions ====================

    public onSearchClick = (): void => {
        defaultDispatcher.fire(Action.OpenSpotlight);
    };

    public onExploreClick = (): void => {
        defaultDispatcher.fire(Action.ViewRoomDirectory);
    };

    public onDialPadClick = (): void => {
        defaultDispatcher.fire(Action.OpenDialPad);
    };

    public onComposeClick = (): void => {
        this.createChatRoom();
    };

    private onProtocolChanged = (): void => {
        this.showDialPad = LegacyCallHandler.instance.getSupportsPstnProtocol() ?? false;
    };

    // ==================== Header State ====================

    private static createHeaderState(
        spaceKey: string,
        activeSpace: Room | null,
        allRoomsInHome: boolean,
        client: MatrixClient,
    ): RoomListHeaderState {
        const spaceName = activeSpace?.name;
        const title = spaceName ?? getMetaSpaceName(spaceKey as MetaSpace, allRoomsInHome);
        const isSpace = Boolean(activeSpace);
        const canCreateRoom = hasCreateRoomRights(client, activeSpace);
        const displayComposeMenu = canCreateRoom;

        // Create space menu state (data only, no callbacks)
        const spaceMenuState: SpaceMenuState | undefined = isSpace
            ? {
                  title: activeSpace?.name ?? "",
                  canInviteInSpace: Boolean(
                      activeSpace?.getJoinRule() === JoinRule.Public ||
                          activeSpace?.canInvite(client.getSafeUserId()),
                  ),
                  canAccessSpaceSettings: Boolean(activeSpace && shouldShowSpaceSettings(activeSpace)),
              }
            : undefined;

        // Create compose menu state (data only, no callbacks)
        const canCreateVideoRoom = SettingsStore.getValue("feature_video_rooms") && canCreateRoom;
        const composeMenuState: ComposeMenuState | undefined = displayComposeMenu
            ? {
                  canCreateRoom,
                  canCreateVideoRoom,
              }
            : undefined;

        // Get active sort option
        const activeSortingAlgorithm = SettingsStore.getValue("RoomList.preferredSorting");
        const activeSortOption =
            activeSortingAlgorithm === SortingAlgorithm.Alphabetic ? SortOption.AToZ : SortOption.Activity;

        return {
            title,
            isSpace,
            spaceMenuState,
            displayComposeMenu,
            composeMenuState,
            activeSortOption,
        };
    }

    // Space menu actions
    public openSpaceHome = (): void => {
        if (!this.activeSpace) return;
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: this.activeSpace.roomId,
            metricsTrigger: undefined,
        });
    };

    public inviteInSpace = (): void => {
        if (!this.activeSpace) return;
        showSpaceInvite(this.activeSpace);
    };

    public openSpacePreferences = (): void => {
        if (!this.activeSpace) return;
        showSpacePreferences(this.activeSpace);
    };

    public openSpaceSettings = (): void => {
        if (!this.activeSpace) return;
        showSpaceSettings(this.activeSpace);
    };

    // Compose menu actions
    public createChatRoom = (): void => {
        defaultDispatcher.fire(Action.CreateChat);
    };

    public createRoom = (): void => {
        createRoomFunc(this.activeSpace);
    };

    public createVideoRoom = (): void => {
        const elementCallVideoRoomsEnabled = SettingsStore.getValue("feature_element_call_video_rooms");
        const type = elementCallVideoRoomsEnabled ? RoomType.UnstableCall : RoomType.ElementVideo;

        if (this.activeSpace) {
            showCreateNewRoom(this.activeSpace, type);
        } else {
            defaultDispatcher.dispatch({
                action: Action.CreateRoom,
                type,
            });
        }
    };

    // Sort options actions
    public sort = (option: SortOption): void => {
        const sortingAlgorithm =
            option === SortOption.AToZ ? SortingAlgorithm.Alphabetic : SortingAlgorithm.Recency;
        RoomListStoreV3.instance.resort(sortingAlgorithm);
    };

    // ==================== Filters ====================

    private static createFilters(activeFilter: FilterKey | undefined): Filter[] {
        const filters = [];

        for (const [key, name] of filterKeyToNameMap.entries()) {
            filters.push({
                name: _t(name),
                active: activeFilter === key,
            });
        }

        return filters;
    }

    public onToggleFilter = (filter: Filter): void => {
        // Find the FilterKey by matching the translated filter name
        let filterKey: FilterKey | undefined = undefined;
        for (const [key, name] of filterKeyToNameMap.entries()) {
            if (_t(name) === filter.name) {
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
        this.updateRoomListData();
    };

    // ==================== Room List State ====================

    private static createRoomListState(roomsResult: RoomsResult, client: MatrixClient): RoomListViewState {
        // Transform rooms into RoomListItems
        const roomListItems: RoomListItem[] = roomsResult.rooms.map((room) => {
            return RoomListViewModel.roomToListItem(room, client);
        });

        return {
            rooms: roomListItems,
            activeRoomIndex: undefined,
            spaceId: roomsResult.spaceId,
            filterKeys: roomsResult.filterKeys?.map(k => String(k)),
        };
    }

    private static roomToListItem(room: Room, client: MatrixClient): RoomListItem {
        const notifState = RoomNotificationStateStore.instance.getRoomState(room);
        const messagePreview = MessagePreviewStore.instance.getPreviewForRoom(room, room.roomId);

        // Get room tags for menu state
        const roomTags = room.tags;
        const isDm = Boolean(DMRoomMap.shared().getUserIdForRoomId(room.roomId));
        const isFavourite = Boolean(roomTags[DefaultTagID.Favourite]);
        const isLowPriority = Boolean(roomTags[DefaultTagID.LowPriority]);
        const isArchived = Boolean(roomTags[DefaultTagID.Archived]);

        // More options menu state
        const showMoreOptionsMenu = hasAccessToOptionsMenu(room);
        const showNotificationMenu = hasAccessToNotificationMenu(room, client.isGuest(), isArchived);

        // Notification levels
        const canMarkAsRead = notifState.level > NotificationLevel.None;
        const canMarkAsUnread = !canMarkAsRead && !isArchived;

        const canInvite =
            room.canInvite(client.getUserId()!) && !isDm && shouldShowComponent(UIComponent.InviteUsers);
        const canCopyRoomLink = !isDm;

        // Get the current room notification state from EchoChamber
        const echoChamber = EchoChamber.forRoom(room);
        const roomNotifState = echoChamber.notificationVolume;

        // Determine which notification option is active
        const isNotificationAllMessage = roomNotifState === ElementRoomNotifState.AllMessages;
        const isNotificationAllMessageLoud = roomNotifState === ElementRoomNotifState.AllMessagesLoud;
        const isNotificationMentionOnly = roomNotifState === ElementRoomNotifState.MentionsOnly;
        const isNotificationMute = roomNotifState === ElementRoomNotifState.Mute;

        return {
            id: room.roomId,
            name: room.name,
            a11yLabel: room.name, // Simplified
            isBold: notifState.hasAnyNotificationOrActivity,
            messagePreview: messagePreview ? (messagePreview as any).text : undefined,
            notification: {
                hasAnyNotificationOrActivity: notifState.hasAnyNotificationOrActivity,
                isUnsentMessage: notifState.isUnsentMessage,
                invited: notifState.invited,
                isMention: notifState.isMention,
                isActivityNotification: notifState.isActivityNotification,
                isNotification: notifState.isNotification,
                count: notifState.count > 0 ? notifState.count : undefined,
                muted: isNotificationMute,
            },
            showMoreOptionsMenu,
            showNotificationMenu,
            moreOptionsState: {
                isFavourite,
                isLowPriority,
                canInvite,
                canCopyRoomLink,
                canMarkAsRead,
                canMarkAsUnread,
            },
            notificationState: {
                isNotificationAllMessage,
                isNotificationAllMessageLoud,
                isNotificationMentionOnly,
                isNotificationMute,
            },
        };
    }

    // ==================== Event Handlers ====================

    private onSpaceChanged = (): void => {
        // Remove listener from old space
        if (this.activeSpace) {
            this.activeSpace.off(RoomEvent.Name, this.onRoomNameChanged);
        }

        this.activeSpace = SpaceStore.instance.activeSpaceRoom;

        // Add listener to new space
        if (this.activeSpace) {
            this.disposables.trackListener(this.activeSpace, RoomEvent.Name, this.onRoomNameChanged);
        }

        // Update showExplore based on new space
        const activeSpace = SpaceStore.instance.activeSpace;
        this.showExplore = activeSpace === MetaSpace.Home && shouldShowComponent(UIComponent.ExploreRooms);

        // Update header state
        const headerState = RoomListViewModel.createHeaderState(
            SpaceStore.instance.activeSpace,
            this.activeSpace,
            SpaceStore.instance.allRoomsInHome,
            this.props.client,
        );
        this.snapshot.merge({ headerState });

        // Update rooms list
        const filterKeys = this.activeFilter !== undefined ? [this.activeFilter] : undefined;
        this.roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filterKeys);
        this.updateRoomListData();
    };

    private onHomeBehaviourChanged = (): void => {
        const spaceKey = SpaceStore.instance.activeSpace;
        const spaceName = this.activeSpace?.name;
        const title = spaceName ?? getMetaSpaceName(spaceKey as MetaSpace, SpaceStore.instance.allRoomsInHome);

        const currentHeaderState = this.snapshot.current.headerState;
        this.snapshot.merge({
            headerState: {
                ...currentHeaderState,
                title,
            },
        });
    };

    private onRoomNameChanged = (): void => {
        if (this.activeSpace) {
            const title = this.activeSpace.name;
            const isSpace = Boolean(this.activeSpace);

            // Update space menu state with new name
            const spaceMenuState: SpaceMenuState | undefined = isSpace
                ? {
                      title,
                      canInviteInSpace: Boolean(
                          this.activeSpace?.getJoinRule() === JoinRule.Public ||
                              this.activeSpace?.canInvite(this.props.client.getSafeUserId()),
                      ),
                      canAccessSpaceSettings: Boolean(this.activeSpace && shouldShowSpaceSettings(this.activeSpace)),
                  }
                : undefined;

            const currentHeaderState = this.snapshot.current.headerState;
            this.snapshot.merge({
                headerState: {
                    ...currentHeaderState,
                    title,
                    spaceMenuState,
                },
            });
        }
    };

    private onListsUpdate = (): void => {
        // Update sort options in header
        const activeSortingAlgorithm = SettingsStore.getValue("RoomList.preferredSorting");
        const activeSortOption =
            activeSortingAlgorithm === SortingAlgorithm.Alphabetic ? SortOption.AToZ : SortOption.Activity;

        const currentHeaderState = this.snapshot.current.headerState;
        this.snapshot.merge({
            headerState: {
                ...currentHeaderState,
                activeSortOption,
            },
        });

        // Update rooms list
        const filterKeys = this.activeFilter !== undefined ? [this.activeFilter] : undefined;
        this.roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filterKeys);
        this.updateRoomListData();
    };

    private onListsLoaded = (): void => {
        // Room lists have finished loading
        this.snapshot.merge({
            isLoadingRooms: false,
        });
    };

    private onNotificationUpdate = (): void => {
        // Notification states changed, update room list items
        this.updateRoomListData();
    };

    private onMessagePreviewUpdate = (): void => {
        // Message previews changed, update room list items
        this.updateRoomListData();
    };

    private updateRoomListData(): void {
        // Update the snapshot with fresh room list data
        const filters = RoomListViewModel.createFilters(this.activeFilter);
        const roomListState = RoomListViewModel.createRoomListState(this.roomsResult, this.props.client);
        const isRoomListEmpty = this.roomsResult.rooms.length === 0;
        const isLoadingRooms = RoomListStoreV3.instance.isLoadingRooms;

        this.snapshot.merge({
            isLoadingRooms,
            isRoomListEmpty,
            filters,
            roomListState,
        });
    }

    // ==================== Keyboard Navigation ====================

    private onDispatch = (payload: any): void => {
        if (payload.action !== Action.ViewRoomDelta) return;

        const currentRoomId = SdkContextClass.instance.roomViewStore.getRoomId();
        if (!currentRoomId) return;

        const { delta, unread } = payload as ViewRoomDeltaPayload;

        // Get the rooms list to navigate through
        const rooms = this.roomsResult.rooms;

        // Filter rooms if unread navigation is requested
        const filteredRooms = unread
            ? rooms.filter((room) => {
                  const state = RoomNotificationStateStore.instance.getRoomState(room);
                  return room.roomId === currentRoomId || state.isUnread;
              })
            : rooms;

        const currentIndex = filteredRooms.findIndex((room) => room.roomId === currentRoomId);
        if (currentIndex === -1) return;

        // Get the next/previous room according to the delta
        // Use modulo to wrap around the list
        const newIndex = (currentIndex + delta + filteredRooms.length) % filteredRooms.length;
        const newRoom = filteredRooms[newIndex];
        if (!newRoom) return;

        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: newRoom.roomId,
            show_room_tile: true, // to make sure the room gets scrolled into view
            metricsTrigger: "WebKeyboardShortcut",
            metricsViaKeyboard: true,
        });
    };

    // ==================== Room Action Handlers ====================

    public onOpenRoom = (roomId: string): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: "RoomList",
        });
    };

    public onMarkAsRead = async (roomId: string): Promise<void> => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        await clearRoomNotification(room, this.props.client);
        // Trigger immediate update for optimistic UI
        this.updateRoomListData();
    };

    public onMarkAsUnread = async (roomId: string): Promise<void> => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        await setMarkedUnreadState(room, this.props.client, true);
        // Trigger immediate update for optimistic UI
        this.updateRoomListData();
    };

    public onToggleFavorite = (roomId: string): void => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        tagRoom(room, DefaultTagID.Favourite);
        // Trigger immediate update for optimistic UI
        this.updateRoomListData();
    };

    public onToggleLowPriority = (roomId: string): void => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        tagRoom(room, DefaultTagID.LowPriority);
        // Trigger immediate update for optimistic UI
        this.updateRoomListData();
    };

    public onInvite = (roomId: string): void => {
        dispatcher.dispatch({
            action: "view_invite",
            roomId: roomId,
        });
    };

    public onCopyRoomLink = (roomId: string): void => {
        dispatcher.dispatch({
            action: "copy_room",
            room_id: roomId,
        });
    };

    public onLeaveRoom = (roomId: string): void => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        const isArchived = Boolean(room.tags[DefaultTagID.Archived]);
        dispatcher.dispatch({
            action: isArchived ? "forget_room" : "leave_room",
            room_id: roomId,
        });
    };

    public onSetRoomNotifState = (roomId: string, notifState: RoomNotifState): void => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;

        // Convert shared-components RoomNotifState to element-web RoomNotifState
        let elementNotifState: ElementRoomNotifState;
        switch (notifState) {
            case "all_messages":
                elementNotifState = ElementRoomNotifState.AllMessages;
                break;
            case "all_messages_loud":
                elementNotifState = ElementRoomNotifState.AllMessagesLoud;
                break;
            case "mentions_only":
                elementNotifState = ElementRoomNotifState.MentionsOnly;
                break;
            case "mute":
                elementNotifState = ElementRoomNotifState.Mute;
                break;
            default:
                elementNotifState = ElementRoomNotifState.AllMessages;
        }

        // Set the notification state using EchoChamber
        const echoChamber = EchoChamber.forRoom(room);
        echoChamber.notificationVolume = elementNotifState;

        // Trigger immediate update for optimistic UI
        // Use setTimeout to allow the echo chamber to update first
        setTimeout(() => this.updateRoomListData(), 0);
    };
}
