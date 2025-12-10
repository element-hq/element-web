/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel, type RoomListViewModel as RoomListVMType, type RoomListItem, type RoomNotifState } from "@element-hq/web-shared-components";
import type { MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import RoomListStoreV3, { RoomListStoreV3Event, type RoomsResult } from "../../../stores/room-list-v3/RoomListStoreV3";
import dispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { type ViewRoomDeltaPayload } from "../../../dispatcher/payloads/ViewRoomDeltaPayload";
import { RoomNotificationStateStore, UPDATE_STATUS_INDICATOR } from "../../../stores/notifications/RoomNotificationStateStore";
import { DefaultTagID } from "../../../stores/room-list/models";
import { MessagePreviewStore } from "../../../stores/room-list/MessagePreviewStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { FilterKey } from "../../../stores/room-list-v3/skip-list/filters";
import { clearRoomNotification, setMarkedUnreadState } from "../../../utils/notifications";
import { tagRoom } from "../../../utils/room/tagRoom";
import DMRoomMap from "../../../utils/DMRoomMap";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { hasAccessToNotificationMenu, hasAccessToOptionsMenu } from "./utils";
import { EchoChamber } from "../../../stores/local-echo/EchoChamber";
import { RoomNotifState as ElementRoomNotifState } from "../../../RoomNotifs";
import { SdkContextClass } from "../../../contexts/SDKContext";

interface RoomListViewModelProps {
    client: MatrixClient;
    activeFilter?: FilterKey;
}

/**
 * ViewModel for the RoomList component.
 * Manages the room list data and actions.
 */
export class RoomListViewModel extends BaseViewModel<any, RoomListViewModelProps>
    implements Omit<RoomListVMType, 'getSnapshot' | 'subscribe'> {

    private roomsResult: RoomsResult;
    private activeFilter: FilterKey | undefined;

    public constructor(props: RoomListWrapperViewModelProps) {
        const roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(
            props.activeFilter ? [props.activeFilter] : undefined
        );

        super(props, RoomListViewModel.createSnapshot(roomsResult, props.client));

        this.roomsResult = roomsResult;
        this.activeFilter = props.activeFilter;

        // Listen to room list updates
        this.disposables.trackListener(
            RoomListStoreV3.instance,
            RoomListStoreV3Event.ListsUpdate as any,
            this.onListsUpdate,
        );

        // Listen to notification state changes
        this.disposables.trackListener(
            RoomNotificationStateStore.instance,
            UPDATE_STATUS_INDICATOR as any,
            this.onNotificationUpdate,
        );

        // Listen to message preview changes
        this.disposables.trackListener(
            MessagePreviewStore.instance,
            UPDATE_EVENT,
            this.onMessagePreviewUpdate,
        );

        // Listen to ViewRoomDelta action for keyboard navigation
        this.disposables.trackDispatcher(dispatcher, this.onDispatch);
    }

    private static createSnapshot(
        roomsResult: RoomsResult,
        client: MatrixClient,
    ): any {
        // Transform rooms into RoomListItems
        const roomListItems: RoomListItem[] = roomsResult.rooms.map((room) => {
            return RoomListViewModel.roomToListItem(room, client);
        });

        return {
            roomsResult: {
                spaceId: roomsResult.spaceId,
                filterKeys: roomsResult.filterKeys,
                rooms: roomListItems,
            },
            activeRoomIndex: undefined,
            onKeyDown: undefined,
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

    private onListsUpdate = (): void => {
        const filterKeys = this.activeFilter !== undefined ? [this.activeFilter] : undefined;
        this.roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filterKeys);

        // Transform rooms into RoomListItems
        const roomListItems: RoomListItem[] = this.roomsResult.rooms.map((room) => {
            return RoomListViewModel.roomToListItem(room, this.props.client);
        });

        this.snapshot.merge({
            roomsResult: {
                spaceId: this.roomsResult.spaceId,
                filterKeys: this.roomsResult.filterKeys,
                rooms: roomListItems,
            },
        });
    };

    public setActiveFilter(filter: FilterKey | undefined): void {
        this.activeFilter = filter;
        this.onListsUpdate();
    }

    private onNotificationUpdate = (): void => {
        // Notification states changed, update room list items
        this.onListsUpdate();
    };

    private onMessagePreviewUpdate = (): void => {
        // Message previews changed, update room list items
        this.onListsUpdate();
    };

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

    // Action implementations - using exact logic from RoomListItemMenuViewModel

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
        this.onListsUpdate();
    };

    public onMarkAsUnread = async (roomId: string): Promise<void> => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        await setMarkedUnreadState(room, this.props.client, true);
        // Trigger immediate update for optimistic UI
        this.onListsUpdate();
    };

    public onToggleFavorite = (roomId: string): void => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        tagRoom(room, DefaultTagID.Favourite);
        // Trigger immediate update for optimistic UI
        this.onListsUpdate();
    };

    public onToggleLowPriority = (roomId: string): void => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        tagRoom(room, DefaultTagID.LowPriority);
        // Trigger immediate update for optimistic UI
        this.onListsUpdate();
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
        setTimeout(() => this.onListsUpdate(), 0);
    };
}
