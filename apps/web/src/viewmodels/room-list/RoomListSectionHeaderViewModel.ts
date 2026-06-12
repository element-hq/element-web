/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import {
    BaseViewModel,
    type NotificationDecorationData,
    type RoomListSectionHeaderActions,
    type RoomListSectionHeaderViewSnapshot,
} from "@element-hq/web-shared-components";

import { RoomNotificationStateStore } from "../../stores/notifications/RoomNotificationStateStore";
import { NotificationStateEvents } from "../../stores/notifications/NotificationState";
import { type RoomNotificationState } from "../../stores/notifications/RoomNotificationState";
import SettingsStore from "../../settings/SettingsStore";
import RoomListStoreV3 from "../../stores/room-list-v3/RoomListStoreV3";
import { getCustomSectionData, isCustomSectionTag, isDefaultSectionTag } from "../../stores/room-list-v3/section";
import PosthogTrackers from "../../PosthogTrackers";
import { CallStore, CallStoreEvent } from "../../stores/CallStore";
import { type Call, CallEvent } from "../../models/Call";

interface RoomListSectionHeaderViewModelProps {
    tag: string;
    title: string;
    /**
     * The ID of the current space.
     */
    spaceId: string;
    onToggleExpanded: (isExpanded: boolean) => void;
}

export class RoomListSectionHeaderViewModel
    extends BaseViewModel<RoomListSectionHeaderViewSnapshot, RoomListSectionHeaderViewModelProps>
    implements RoomListSectionHeaderActions
{
    /**
     * The notification states of the rooms currently in this section, used to compute the unread state.
     */
    private roomNotificationStates = new Set<RoomNotificationState>();

    /**
     * Tracks the expanded/collapsed state per space.
     * Key is spaceId. Defaults to expanded if not set.
     */
    private readonly expandedBySpace = new Map<string, boolean>();

    /**
     * The calls of the rooms currently in this section that we are listening to, used to aggregate the call decoration.
     */
    private currentCalls = new Set<Call>();

    public constructor(props: RoomListSectionHeaderViewModelProps) {
        const isDefaultSection = isDefaultSectionTag(props.tag);
        super(props, {
            id: props.tag,
            title: props.title,
            isExpanded: true,
            isUnread: false,
            displaySectionMenu: !isDefaultSection,
        });
        const sectionWatherRef = SettingsStore.watchSetting("RoomList.CustomSectionData", null, () =>
            this.onCustomSectionDataChange(),
        );
        this.disposables.track(() => SettingsStore.unwatchSetting(sectionWatherRef));

        // Recompute the decoration when a call starts or ends in any room
        this.disposables.trackListener(CallStore.instance, CallStoreEvent.Call, this.onCallChanged);
    }

    public onClick = (): void => {
        const isExpanded = !this.snapshot.current.isExpanded;
        this.expandedBySpace.set(this.props.spaceId, isExpanded);
        this.snapshot.merge({ isExpanded });
        this.props.onToggleExpanded(isExpanded);
    };

    /**
     * Whether the section is currently expanded or not.
     */
    public get isExpanded(): boolean {
        return this.snapshot.current.isExpanded;
    }

    /**
     * Set whether the section is expanded for the current space.
     * This will not trigger the onToggleExpanded callback.
     */
    public set isExpanded(value: boolean) {
        this.expandedBySpace.set(this.props.spaceId, value);
        this.snapshot.merge({ isExpanded: value });

        const kind = value ? "Expand" : "Collapse";
        PosthogTrackers.trackCollapseOrExpandSection(kind, "SectionHeader");
    }

    /**
     * Switch to a different space, restoring the expanded state for that space.
     * Defaults to expanded if no state has been saved for the space.
     */
    public setSpace(spaceId: string): void {
        this.props.spaceId = spaceId;
        const isExpanded = this.expandedBySpace.get(this.props.spaceId) ?? true;
        this.snapshot.merge({ isExpanded });
    }

    /**
     * Update the rooms tracked by this section header for unread state computation.
     * Only subscribes to new rooms and unsubscribes from rooms no longer in the section.
     * @param rooms - The rooms currently in this section
     */
    public setRooms(rooms: Room[]): void {
        const newStates = new Set(rooms.map((room) => RoomNotificationStateStore.instance.getRoomState(room)));

        // Unsubscribe from rooms no longer in the section
        for (const state of this.roomNotificationStates) {
            if (!newStates.has(state)) {
                state.off(NotificationStateEvents.Update, this.updateNotificationState);
            }
        }

        // Subscribe to newly added rooms
        for (const state of newStates) {
            if (!this.roomNotificationStates.has(state)) {
                // We don't use trackListener because we don't want to grow the disposables indefinitely as rooms are added and removed from the section
                state.on(NotificationStateEvents.Update, this.updateNotificationState);
            }
        }

        this.roomNotificationStates = newStates;
        this.updateCallListeners();
        this.updateNotificationState();
    }

    /**
     * Subscribe to participant/type changes of the calls in the section's rooms, and unsubscribe
     * from calls that are no longer present. Mirrors the call tracking done per room list item.
     */
    private updateCallListeners(): void {
        const newCalls = new Set<Call>();
        for (const state of this.roomNotificationStates) {
            const call = state.room && CallStore.instance.getCall(state.room.roomId);
            if (call) newCalls.add(call);
        }

        // Unsubscribe from calls no longer present
        for (const call of this.currentCalls) {
            if (!newCalls.has(call)) {
                call.off(CallEvent.Participants, this.updateNotificationState);
                call.off(CallEvent.CallTypeChanged, this.updateNotificationState);
            }
        }

        // Subscribe to newly added calls
        for (const call of newCalls) {
            if (!this.currentCalls.has(call)) {
                call.on(CallEvent.Participants, this.updateNotificationState);
                call.on(CallEvent.CallTypeChanged, this.updateNotificationState);
            }
        }

        this.currentCalls = newCalls;
    }

    private onCallChanged = (): void => {
        this.updateCallListeners();
        this.updateNotificationState();
    };

    /**
     * Update the section header from the notification states of the tracked rooms.
     * Computes both the unread (bold) state and a merged notification decoration that aggregates
     * the rooms' notifications. The activity "dot" is intentionally excluded from the decoration.
     */
    private updateNotificationState = (): void => {
        let isUnread = false;
        let isMention = false;
        let isNotification = false;
        let isUnsentMessage = false;
        let hasUnreadCount = false;
        let invited = false;
        let count = 0;
        let callType: "video" | "voice" | undefined = undefined;

        for (const state of this.roomNotificationStates) {
            if (state.hasAnyNotificationOrActivity) isUnread = true;
            if (state.isMention) isMention = true;
            if (state.isNotification) isNotification = true;
            if (state.isUnsentMessage) isUnsentMessage = true;
            if (state.hasUnreadCount) hasUnreadCount = true;
            if (state.invited) invited = true;
            // Mention, notification, Mark as unread are aggregated
            if (state.isMention || state.isNotification) count += state.count || 1;

            // Aggregate active calls, preferring a video call over a voice call
            const call = state.room && CallStore.instance.getCall(state.room.roomId);
            if (call && call.participants.size > 0) {
                if (call.callType === CallType.Video) callType = "video";
                else if (call.callType === CallType.Voice && callType !== "video") callType = "voice";
            }
        }

        const notification: NotificationDecorationData = {
            // Drives the decoration's early-return: an activity-only section stays bold but shows no badge
            hasAnyNotificationOrActivity:
                isMention || isNotification || isUnsentMessage || invited || Boolean(callType),
            isUnsentMessage,
            isMention,
            isNotification,
            hasUnreadCount,
            count,
            invited,
            callType,
            // The activity dot and muted bell are intentionally not aggregated onto the section header
            isActivityNotification: false,
            muted: false,
        };

        this.snapshot.merge({ isUnread, notification });
    };

    public dispose(): void {
        for (const state of this.roomNotificationStates) {
            state.off(NotificationStateEvents.Update, this.updateNotificationState);
        }
        this.roomNotificationStates.clear();
        for (const call of this.currentCalls) {
            call.off(CallEvent.Participants, this.updateNotificationState);
            call.off(CallEvent.CallTypeChanged, this.updateNotificationState);
        }
        this.currentCalls.clear();
        super.dispose();
    }

    /**
     * Handle changes to custom section data.
     */
    private onCustomSectionDataChange(): void {
        const sectionData = isCustomSectionTag(this.props.tag) ? getCustomSectionData()[this.props.tag] : undefined;
        if (sectionData) {
            this.snapshot.merge({ title: sectionData.name });
        }
    }

    public editSection = async (): Promise<void> => {
        await RoomListStoreV3.instance.editSection(this.props.tag);
    };

    public removeSection = async (): Promise<void> => {
        // There is one notification state per room in the section
        const isEmpty = this.roomNotificationStates.size === 0;
        await RoomListStoreV3.instance.removeSection(this.props.tag, isEmpty);

        PosthogTrackers.trackInteraction("WebDeleteSection");
    };
}
