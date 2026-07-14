/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    BaseViewModel,
    RoomNotifState,
    type RoomListItemViewSnapshot,
    type RoomListItemViewActions,
    type Section,
    type UserStatus,
} from "@element-hq/web-shared-components";
import { ClientEvent, RoomEvent } from "matrix-js-sdk/src/matrix";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { logger } from "matrix-js-sdk/src/logger";

import type { Room, MatrixClient, RoomMember, ClientEventHandlerMap } from "matrix-js-sdk/src/matrix";
import type { RoomNotificationState } from "../../stores/notifications/RoomNotificationState";
import { RoomNotificationStateStore } from "../../stores/notifications/RoomNotificationStateStore";
import { NotificationStateEvents } from "../../stores/notifications/NotificationState";
import { MessagePreviewStore } from "../../stores/message-preview";
import { DefaultTagID } from "../../stores/room-list-v3/skip-list/tag";
import DMRoomMap from "../../utils/DMRoomMap";
import SettingsStore from "../../settings/SettingsStore";
import { NotificationLevel } from "../../stores/notifications/NotificationLevel";
import { hasAccessToNotificationMenu, hasAccessToOptionsMenu } from "./utils";
import { EchoChamber } from "../../stores/local-echo/EchoChamber";
import { RoomNotifState as ElementRoomNotifState } from "../../RoomNotifs";
import { shouldShowComponent } from "../../customisations/helpers/UIComponents";
import { UIComponent } from "../../settings/UIFeature";
import { CallStore, CallStoreEvent } from "../../stores/CallStore";
import { clearRoomNotification, setMarkedUnreadState } from "../../utils/notifications";
import { tagRoom } from "../../utils/room/tagRoom";
import { keepIfSame } from "../../utils/keepIfSame";
import dispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import type { ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import PosthogTrackers from "../../PosthogTrackers";
import { type Call, CallEvent } from "../../models/Call";
import RoomListStoreV3 from "../../stores/room-list-v3/RoomListStoreV3";
import { getCustomSectionData, isDefaultSectionTag } from "../../stores/room-list-v3/section";
import { _t } from "../../languageHandler";
import { fetchUserStatus, validateUserStatus } from "../../utils/userStatus";

/**
 * View section type without `isSelected` field
 */
type Sections = Array<Omit<Section, "isSelected">>;

interface RoomItemProps {
    room: Room;
    client: MatrixClient;
}

/**
 * View model for an individual room list item.
 * Manages per-room subscriptions and updates only when this specific room's data changes.
 * Implements RoomListItemViewActions to provide interaction callbacks.
 */
export class RoomListItemViewModel
    extends BaseViewModel<RoomListItemViewSnapshot, RoomItemProps>
    implements RoomListItemViewActions
{
    private notifState: RoomNotificationState;
    /**
     * Track the current call for this room to manager listeners
     */
    private currentCall: Call | null = null;
    /**
     * The sections available in the "Move to section" submenu (tag + display name), identical
     * for every update of this item. Computing it reads the custom section settings, so it is
     * built once and rebuilt only when those settings change (see {@link onCustomSectionsChange})
     * rather than on every snapshot rebuild; only the per-room isSelected flag is derived per
     * snapshot (see {@link buildSections}).
     */
    private availableSections: Sections;

    /**
     * The user ID of the other user if this room is a DM, used to show their user status.
     */
    private readonly dmUserId?: string;

    public constructor(props: RoomItemProps) {
        // Get notification state first so we can generate a complete initial snapshot
        const notifState = RoomNotificationStateStore.instance.getRoomState(props.room);
        const availableSections = RoomListItemViewModel.computeAvailableSections();
        const initialItem = RoomListItemViewModel.generateItemSync(
            props.room,
            props.client,
            notifState,
            availableSections,
        );
        super(props, initialItem);

        this.notifState = notifState;
        this.availableSections = availableSections;

        // Subscribe to notification state changes for this room
        this.disposables.trackListener(this.notifState, NotificationStateEvents.Update, this.onNotificationChanged);

        // Subscribe to message preview changes for this specific room
        this.disposables.trackListener(
            MessagePreviewStore.instance,
            MessagePreviewStore.getPreviewChangedEventName(props.room),
            this.onMessagePreviewChanged,
        );

        // Subscribe to settings changes for message preview toggle
        const settingsWatchRef = SettingsStore.watchSetting(
            "RoomList.showMessagePreview",
            null,
            this.onMessagePreviewSettingChanged,
        );
        this.disposables.track(() => {
            SettingsStore.unwatchSetting(settingsWatchRef);
        });

        // Subscribe to settings changes for section toggle
        const settingsShowSectionsRef = SettingsStore.watchSetting(
            "RoomList.showSections",
            null,
            this.onShowSectionsChange,
        );
        this.disposables.track(() => SettingsStore.unwatchSetting(settingsShowSectionsRef));

        // Subscribe to call state changes
        this.disposables.trackListener(CallStore.instance, CallStoreEvent.Call, this.onCallStateChanged);
        // If there is an active call for this room, listen to participant changes
        this.listenToCallParticipants();

        // Subscribe to room-specific events
        this.disposables.trackListener(props.room, RoomEvent.Name, this.onRoomChanged);
        this.disposables.trackListener(props.room, RoomEvent.Tags, this.onRoomChanged);

        // Rebuild the available sections when their order changes or when one is created/renamed/removed
        const orderSectionsRef = SettingsStore.watchSetting("RoomList.OrderedCustomSections", null, () =>
            this.onCustomSectionsChange(),
        );
        const sectionDataRef = SettingsStore.watchSetting("RoomList.CustomSectionData", null, () =>
            this.onCustomSectionsChange(),
        );
        this.disposables.track(() => {
            SettingsStore.unwatchSetting(orderSectionsRef);
            SettingsStore.unwatchSetting(sectionDataRef);
        });

        // Load message preview asynchronously (sync data is already complete)
        void this.loadAndSetMessagePreview();

        // If this room is a DM, show the MSC4426 user status of the other user
        this.dmUserId = DMRoomMap.shared().getUserIdForRoomId(props.room.roomId) ?? undefined;
        if (this.dmUserId) {
            props.client.on(ClientEvent.UserProfileUpdate, this.onUserProfileUpdate);
            this.disposables.track(() => {
                props.client.off(ClientEvent.UserProfileUpdate, this.onUserProfileUpdate);
            });

            this.updateUserStatus();
        }
    }

    public dispose(): void {
        super.dispose();
        this.currentCall?.off(CallEvent.Participants, this.onCallParticipantsChanged);
        this.currentCall?.off(CallEvent.CallTypeChanged, this.onCallTypeChanged);
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

    private readonly onShowSectionsChange = (): void => {
        const areSectionsEnabled = SettingsStore.getValue("RoomList.showSections");
        this.snapshot.merge({ areSectionsEnabled });
    };

    /**
     * Handler for call participant changes. Only updates the item if the call moves between having participants and not having participants, to avoid unnecessary updates.
     * @param participants The current call participants
     */
    private onCallParticipantsChanged = (participants: Map<RoomMember, Set<string>>): void => {
        const hasCall = Boolean(this.snapshot.current.notification.callType);
        // There is already an active call, we don't need to update the item
        if (hasCall && participants.size > 0) return;

        this.updateItem();
    };

    /**
     * Handler for call type changes. Only updates the item if the call type is actually present in the snapshot.
     */
    private onCallTypeChanged = (): void => {
        if (this.snapshot.current.notification.callType !== undefined) this.updateItem();
    };

    /**
     * Listen to participant changes for the current call in this room (if any) to trigger updates when participants join/leave the call.
     */
    private listenToCallParticipants(): void {
        const call = CallStore.instance.getCall(this.props.room.roomId);

        // Remove listeners from previous call (if any) and add to new call to track changes
        if (call !== this.currentCall) {
            this.currentCall?.off(CallEvent.Participants, this.onCallParticipantsChanged);
            this.currentCall?.off(CallEvent.CallTypeChanged, this.onCallTypeChanged);
            call?.on(CallEvent.Participants, this.onCallParticipantsChanged);
            call?.on(CallEvent.CallTypeChanged, this.onCallTypeChanged);
        }
        this.currentCall = call;
    }

    private onCallStateChanged = (): void => {
        // Only update if call state for this room actually changed
        const call = CallStore.instance.getCall(this.props.room.roomId);

        this.listenToCallParticipants();

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
        const newItem = RoomListItemViewModel.generateItemSync(
            this.props.room,
            this.props.client,
            this.notifState,
            this.availableSections,
        );
        this.snapshot.merge({
            ...newItem,
            notification: keepIfSame(this.snapshot.current.notification, newItem.notification),
            sections: keepIfSame(this.snapshot.current.sections, newItem.sections),
            // Preserve message preview - it's managed separately by loadAndSetMessagePreview
            messagePreview: this.snapshot.current.messagePreview,
        });
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
        this.snapshot.merge({ messagePreview });
    }

    /**
     * Handler for profile updates received via sync, to keep the DM user's status up to date.
     */
    private onUserProfileUpdate: ClientEventHandlerMap[ClientEvent.UserProfileUpdate] = (userId, profile) => {
        if (userId !== this.dmUserId || !SettingsStore.getValue("feature_user_status")) return;
        this.snapshot.merge({ userStatus: validateUserStatus(profile?.["org.matrix.msc4426.status"]) });
    };

    /**
     * Fetch and set the user status of the DM user, if the feature is enabled.
     */
    private updateUserStatus(): void {
        (async () => {
            let userStatus: UserStatus | undefined;
            if (this.dmUserId && SettingsStore.getValue("feature_user_status")) {
                userStatus = await fetchUserStatus(this.props.client, this.dmUserId);
            }
            if (this.disposables.isDisposed) return;
            this.snapshot.merge({ userStatus });
        })().catch((ex) => {
            logger.warn(`Failed to update userStatus for ${this.dmUserId}`, ex);
        });
    }

    /**
     * Generate a complete RoomListItem with all synchronous data.
     * Message preview is loaded separately to avoid blocking initial render.
     */
    private static generateItemSync(
        room: Room,
        client: MatrixClient,
        notifState: RoomNotificationState,
        availableSections: Sections,
    ): RoomListItemViewSnapshot {
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

        // Build sections list for the "Move to section" submenu
        const sections: Section[] = RoomListItemViewModel.buildSections(roomTags, availableSections);
        const areSectionsEnabled = SettingsStore.getValue("RoomList.showSections");

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
            sections,
            areSectionsEnabled,
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

    public onCreateSection = async (): Promise<void> => {
        const newTag = await RoomListStoreV3.instance.createSection();
        PosthogTrackers.trackSectionCreation("RoomListItemOverflowMenu");

        // Add the room to the section
        if (newTag) {
            tagRoom(this.props.room, newTag);
        }
    };

    public onToggleSection = (tag: string): void => {
        tagRoom(this.props.room, tag);
    };

    public onRemoveFromSection = (): void => {
        const roomTags = this.props.room.tags;
        const sectionTag = RoomListStoreV3.instance.orderedSectionTags.find((tag) => Boolean(roomTags[tag]));
        if (sectionTag) {
            tagRoom(this.props.room, sectionTag);
        }
    };

    private onCustomSectionsChange = (): void => {
        // Rebuild the available sections and the sections list to reflect the new settings
        this.availableSections = RoomListItemViewModel.computeAvailableSections();
        const sections = RoomListItemViewModel.buildSections(this.props.room.tags, this.availableSections);
        this.snapshot.merge({ sections: keepIfSame(this.snapshot.current.sections, sections) });
    };

    /**
     * Compute the sections available in the "Move to section" submenu.
     * Order follows the canonical section order from RoomListStoreV3.
     * Reads the custom section settings, so callers should cache the result and recompute only
     * when those settings change.
     */
    private static computeAvailableSections(): Sections {
        const customSectionData = getCustomSectionData();

        return (
            RoomListStoreV3.instance.orderedSectionTags
                // Exclude the Chats because the user toggle the other sections to move rooms in and out of the Chats section.
                // Also exclude the default sections because they are available as toggles in the main context menu, and we don't want them to be duplicated in the "Move to section" submenu.
                .filter((tag) => !isDefaultSectionTag(tag))
                .map((tag) => ({
                    tag,
                    name: RoomListItemViewModel.getSectionName(tag, customSectionData),
                }))
        );
    }

    /**
     * Build the list of sections for the "Move to section" submenu by deriving the per-room
     * selected state from the room's tags.
     */
    private static buildSections(roomTags: Room["tags"], availableSections: Sections): Section[] {
        return availableSections.map(({ tag, name }) => ({
            tag,
            name,
            isSelected: Boolean(roomTags[tag]),
        }));
    }

    /**
     * Get the display name for a section based on its tag.
     */
    private static getSectionName(tag: string, customSectionData: Record<string, { name: string }>): string {
        if (tag === DefaultTagID.Favourite) return _t("room_list|section|favourites");
        if (tag === DefaultTagID.LowPriority) return _t("room_list|section|low_priority");
        return customSectionData[tag]?.name || tag;
    }
}
