/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type RoomListSectionHeaderActions,
    type RoomListSectionHeaderViewSnapshot,
} from "@element-hq/web-shared-components";

import { RoomNotificationStateStore } from "../../stores/notifications/RoomNotificationStateStore";
import { NotificationStateEvents } from "../../stores/notifications/NotificationState";
import { type RoomNotificationState } from "../../stores/notifications/RoomNotificationState";

interface RoomListSectionHeaderViewModelProps {
    tag: string;
    title: string;
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

    public constructor(props: RoomListSectionHeaderViewModelProps) {
        super(props, { id: props.tag, title: props.title, isExpanded: true, isUnread: false });
    }

    public onClick = (): void => {
        const isExpanded = !this.snapshot.current.isExpanded;
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
     * Set whether the section is expanded.
     * This will not trigger the onToggleExpanded callback.
     */
    public set isExpanded(value: boolean) {
        this.snapshot.merge({ isExpanded: value });
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
                state.off(NotificationStateEvents.Update, this.updateUnreadState);
            }
        }

        // Subscribe to newly added rooms
        for (const state of newStates) {
            if (!this.roomNotificationStates.has(state)) {
                // We don't use trackListener because we don't want to grow the disposables indefinitely as rooms are added and removed from the section
                state.on(NotificationStateEvents.Update, this.updateUnreadState);
            }
        }

        this.roomNotificationStates = newStates;
        this.updateUnreadState();
    }

    /**
     * Update the unread state of the section header based on the notification states of the tracked rooms.
     */
    private updateUnreadState = (): void => {
        const isUnread = [...this.roomNotificationStates].some((state) => state.hasAnyNotificationOrActivity);
        this.snapshot.merge({ isUnread });
    };

    public dispose(): void {
        for (const state of this.roomNotificationStates) {
            state.off(NotificationStateEvents.Update, this.updateUnreadState);
        }
        this.roomNotificationStates.clear();
        super.dispose();
    }
}
