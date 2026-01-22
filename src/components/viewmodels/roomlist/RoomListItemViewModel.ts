/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    BaseViewModel,
    RoomNotifState,
    type RoomListItemSnapshot,
    type RoomListItemActions,
} from "@element-hq/web-shared-components";
import { RoomEvent } from "matrix-js-sdk/src/matrix";
import { CallType } from "matrix-js-sdk/src/webrtc/call";

import type { Room, MatrixClient } from "matrix-js-sdk/src/matrix";
import type { RoomNotificationState } from "../../../stores/notifications/RoomNotificationState";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { NotificationStateEvents } from "../../../stores/notifications/NotificationState";
import { MessagePreviewStore } from "../../../stores/room-list/MessagePreviewStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { DefaultTagID } from "../../../stores/room-list/models";
import DMRoomMap from "../../../utils/DMRoomMap";
import SettingsStore from "../../../settings/SettingsStore";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { hasAccessToNotificationMenu, hasAccessToOptionsMenu } from "./utils";
import { EchoChamber } from "../../../stores/local-echo/EchoChamber";
import { RoomNotifState as ElementRoomNotifState } from "../../../RoomNotifs";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { CallStore, CallStoreEvent } from "../../../stores/CallStore";
import { clearRoomNotification, setMarkedUnreadState } from "../../../utils/notifications";
import { tagRoom } from "../../../utils/room/tagRoom";
import dispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import PosthogTrackers from "../../../PosthogTrackers";

interface RoomItemProps {
    room: Room;
    client: MatrixClient;
}

/**
 * View model for an individual room list item.
 * Manages per-room subscriptions and updates only when this specific room's data changes.
 * Implements RoomListItemActions to provide interaction callbacks.
 */
export class RoomListItemViewModel
    extends BaseViewModel<RoomListItemSnapshot, RoomItemProps>
    implements RoomListItemActions
{
    private notifState: RoomNotificationState;

    public constructor(props: RoomItemProps) {
        // Get notification state first so we can generate a complete initial snapshot
        const notifState = RoomNotificationStateStore.instance.getRoomState(props.room);
        const initialItem = RoomListItemViewModel.generateItemSync(props.room, props.client, notifState);
        super(props, initialItem);

        this.notifState = notifState;

        // Subscribe to notification state changes for this room
        this.disposables.trackListener(this.notifState, NotificationStateEvents.Update, this.onNotificationChanged);

        // Subscribe to message preview changes (will filter to this room)
        this.disposables.trackListener(MessagePreviewStore.instance, UPDATE_EVENT, this.onMessagePreviewChanged);

        // Subscribe to settings changes for message preview toggle
        const settingsWatchRef = SettingsStore.watchSetting(
            "RoomList.showMessagePreview",
            null,
            this.onMessagePreviewSettingChanged,
        );
        this.disposables.track(() => {
            SettingsStore.unwatchSetting(settingsWatchRef);
        });

        // Subscribe to call state changes
        this.disposables.trackListener(CallStore.instance, CallStoreEvent.ConnectedCalls, this.onCallStateChanged);

        // Subscribe to room-specific events
        this.disposables.trackListener(props.room, RoomEvent.Name, this.onRoomChanged);
        this.disposables.trackListener(props.room, RoomEvent.Tags, this.onRoomChanged);

        // Load message preview asynchronously (sync data is already complete)
        void this.loadAndSetMessagePreview();
    }

    private onNotificationChanged = (): void => {
        this.updateItem();
    };

    private onMessagePreviewChanged = (): void => {
        void this.loadAndSetMessagePreview();
    };

    private onMessagePreviewSettingChanged = (): void => {
        void this.loadAndSetMessagePreview();
    };

    private onCallStateChanged = (): void => {
        // Only update if call state for this room actually changed
        const call = CallStore.instance.getCall(this.props.room.roomId);
        const currentCallType = this.snapshot.current.notification.callType;
        const newCallType =
            call && call.participants.size > 0 ? (call.callType === CallType.Voice ? "voice" : "video") : undefined;

        if (currentCallType !== newCallType) {
            this.updateItem();
        }
    };

    private onRoomChanged = (): void => {
        this.updateItem();
    };

    /**
     * Update the item snapshot with current sync data.
     * Preserves the message preview which is managed separately.
     */
    private updateItem(): void {
        const newItem = RoomListItemViewModel.generateItemSync(this.props.room, this.props.client, this.notifState);
        // Preserve message preview - it's managed separately by loadAndSetMessagePreview
        this.snapshot.set({ ...newItem, messagePreview: this.snapshot.current.messagePreview });
    }

    private getMessagePreviewTag(): string {
        const isDm = Boolean(DMRoomMap.shared().getUserIdForRoomId(this.props.room.roomId));
        return isDm ? DefaultTagID.DM : DefaultTagID.Untagged;
    }

    /**
     * Load the message preview for this room if enabled.
     * Returns undefined if previews are disabled or couldn't be loaded.
     */
    private async loadMessagePreview(): Promise<string | undefined> {
        const shouldShowMessagePreview = SettingsStore.getValue("RoomList.showMessagePreview");
        if (!shouldShowMessagePreview) {
            return undefined;
        }

        const messagePreviewTag = this.getMessagePreviewTag();
        const preview = await MessagePreviewStore.instance.getPreviewForRoom(this.props.room, messagePreviewTag);
        return preview?.text;
    }

    /**
     * Load and set the message preview if it differs from current.
     */
    private async loadAndSetMessagePreview(): Promise<void> {
        const messagePreview = await this.loadMessagePreview();
        if (messagePreview !== this.snapshot.current.messagePreview) {
            this.snapshot.merge({ messagePreview });
        }
    }

    /**
     * Generate a complete RoomListItem with all synchronous data.
     * Message preview is loaded separately to avoid blocking initial render.
     */
    private static generateItemSync(
        room: Room,
        client: MatrixClient,
        notifState: RoomNotificationState,
    ): RoomListItemSnapshot {
        // Get room tags for menu state
        const roomTags = room.tags;
        const isDm = Boolean(DMRoomMap.shared().getUserIdForRoomId(room.roomId));

        // Message preview will be loaded asynchronously and updated separately
        const messagePreview = undefined;

        const isFavourite = Boolean(roomTags[DefaultTagID.Favourite]);
        const isLowPriority = Boolean(roomTags[DefaultTagID.LowPriority]);
        const isArchived = Boolean(roomTags[DefaultTagID.Archived]);

        // More options menu state
        const showMoreOptionsMenu = hasAccessToOptionsMenu(room);
        const showNotificationMenu = hasAccessToNotificationMenu(room, client.isGuest(), isArchived);

        // Notification levels
        const canMarkAsRead = notifState.level > NotificationLevel.None;
        const canMarkAsUnread = !canMarkAsRead && !isArchived;

        const canInvite = room.canInvite(client.getUserId()!) && !isDm && shouldShowComponent(UIComponent.InviteUsers);
        const canCopyRoomLink = !isDm;

        // Get the current room notification state from EchoChamber
        const echoChamber = EchoChamber.forRoom(room);
        const elementRoomNotifState = echoChamber.notificationVolume;

        // Convert element-web RoomNotifState to shared-components RoomNotifState
        let roomNotifState: RoomNotifState;
        switch (elementRoomNotifState) {
            case ElementRoomNotifState.AllMessages:
                roomNotifState = RoomNotifState.AllMessages;
                break;
            case ElementRoomNotifState.AllMessagesLoud:
                roomNotifState = RoomNotifState.AllMessagesLoud;
                break;
            case ElementRoomNotifState.MentionsOnly:
                roomNotifState = RoomNotifState.MentionsOnly;
                break;
            case ElementRoomNotifState.Mute:
                roomNotifState = RoomNotifState.Mute;
                break;
            default:
                roomNotifState = RoomNotifState.AllMessages;
        }

        const isNotificationMute = elementRoomNotifState === ElementRoomNotifState.Mute;

        // Video room and call state tracking
        const call = CallStore.instance.getCall(room.roomId);
        const participantCount = call?.participants.size ?? 0;
        const hasParticipantsInCall = participantCount > 0;
        const callType =
            call?.callType === CallType.Voice ? "voice" : call?.callType === CallType.Video ? "video" : undefined;

        return {
            id: room.roomId,
            room,
            name: room.name,
            isBold: notifState.hasAnyNotificationOrActivity,
            messagePreview,
            notification: {
                hasAnyNotificationOrActivity: notifState.hasAnyNotificationOrActivity || hasParticipantsInCall,
                isUnsentMessage: notifState.isUnsentMessage,
                invited: notifState.invited,
                isMention: notifState.isMention,
                isActivityNotification: notifState.isActivityNotification,
                isNotification: notifState.isNotification,
                hasUnreadCount: notifState.hasUnreadCount,
                count: notifState.count,
                muted: isNotificationMute,
                callType: hasParticipantsInCall ? callType : undefined,
            },
            showMoreOptionsMenu,
            showNotificationMenu,
            isFavourite,
            isLowPriority,
            canInvite,
            canCopyRoomLink,
            canMarkAsRead,
            canMarkAsUnread,
            roomNotifState,
        };
    }

    public onOpenRoom = (): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: this.props.room.roomId,
            metricsTrigger: "RoomList",
        });
    };

    public onMarkAsRead = async (): Promise<void> => {
        await clearRoomNotification(this.props.room, this.props.client);
        PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuMarkRead");
    };

    public onMarkAsUnread = async (): Promise<void> => {
        await setMarkedUnreadState(this.props.room, this.props.client, true);
        PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuMarkUnread");
    };

    public onToggleFavorite = (): void => {
        tagRoom(this.props.room, DefaultTagID.Favourite);
        PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuFavouriteToggle");
    };

    public onToggleLowPriority = (): void => {
        tagRoom(this.props.room, DefaultTagID.LowPriority);
    };

    public onInvite = (): void => {
        dispatcher.dispatch({
            action: "view_invite",
            roomId: this.props.room.roomId,
        });
        PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuInviteItem");
    };

    public onCopyRoomLink = (): void => {
        dispatcher.dispatch({
            action: "copy_room",
            room_id: this.props.room.roomId,
        });
    };

    public onLeaveRoom = (): void => {
        const isArchived = Boolean(this.props.room.tags[DefaultTagID.Archived]);
        dispatcher.dispatch({
            action: isArchived ? "forget_room" : "leave_room",
            room_id: this.props.room.roomId,
        });
        PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuLeaveItem");
    };

    public onSetRoomNotifState = (notifState: RoomNotifState): void => {
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
        const echoChamber = EchoChamber.forRoom(this.props.room);
        echoChamber.notificationVolume = elementNotifState;
    };
}
