/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type NotificationCount, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { BaseViewModel, type NotificationBadgeViewSnapshot } from "@element-hq/web-shared-components";

import { determineUnreadState } from "../../../RoomNotifs";
import SettingsStore from "../../../settings/SettingsStore";
import { computeNotificationBadgeViewSnapshot } from "./notificationBadgeSnapshot";

export interface UnreadNotificationBadgeViewModelProps {
    room?: Room;
    threadId?: string;
    forceDot?: boolean;
}

interface InternalProps extends UnreadNotificationBadgeViewModelProps {
    hideBold: boolean;
}

export class UnreadNotificationBadgeViewModel extends BaseViewModel<NotificationBadgeViewSnapshot, InternalProps> {
    private roomListenerDisposers: Array<() => void> = [];

    private static readonly computeSnapshot = (props: InternalProps): NotificationBadgeViewSnapshot => {
        const { symbol, count, level } = determineUnreadState(props.room, props.threadId, false);

        return computeNotificationBadgeViewSnapshot({
            symbol,
            count,
            level,
            forceDot: props.forceDot,
            hideBold: props.hideBold,
        });
    };

    public constructor(props: UnreadNotificationBadgeViewModelProps) {
        const internalProps: InternalProps = {
            ...props,
            hideBold: SettingsStore.getValue("feature_hidebold"),
        };

        super(internalProps, UnreadNotificationBadgeViewModel.computeSnapshot(internalProps));

        this.attachRoomListeners(internalProps.room);
        this.disposables.track(() => this.detachRoomListeners());

        const hideBoldWatcherRef = SettingsStore.watchSetting("feature_hidebold", null, this.onHideBoldSettingChanged);
        this.disposables.track(() => SettingsStore.unwatchSetting(hideBoldWatcherRef));
    }

    public setRoom(room?: Room): void {
        if (this.props.room === room) return;

        this.detachRoomListeners();
        this.props = {
            ...this.props,
            room,
        };
        this.attachRoomListeners(room);
        this.updateSnapshotFromProps();
    }

    public setThreadId(threadId?: string): void {
        if (this.props.threadId === threadId) return;

        this.props = {
            ...this.props,
            threadId,
        };
        this.updateSnapshotFromProps();
    }

    public setForceDot(forceDot?: boolean): void {
        if (this.props.forceDot === forceDot) return;

        this.props = {
            ...this.props,
            forceDot,
        };
        this.updateSnapshotFromProps();
    }

    private setHideBold(hideBold: boolean): void {
        if (this.props.hideBold === hideBold) return;

        this.props = {
            ...this.props,
            hideBold,
        };
        this.updateSnapshotFromProps();
    }

    private updateSnapshotFromProps(): void {
        this.snapshot.merge(UnreadNotificationBadgeViewModel.computeSnapshot(this.props));
    }

    private attachRoomListeners(room?: Room): void {
        if (!room) return;

        room.on(RoomEvent.UnreadNotifications, this.onRoomUnreadNotifications);
        room.on(RoomEvent.Receipt, this.onNotificationChanged);
        room.on(RoomEvent.Timeline, this.onNotificationChanged);
        room.on(RoomEvent.Redaction, this.onNotificationChanged);
        room.on(RoomEvent.LocalEchoUpdated, this.onNotificationChanged);
        room.on(RoomEvent.MyMembership, this.onNotificationChanged);

        this.roomListenerDisposers = [
            () => room.off(RoomEvent.UnreadNotifications, this.onRoomUnreadNotifications),
            () => room.off(RoomEvent.Receipt, this.onNotificationChanged),
            () => room.off(RoomEvent.Timeline, this.onNotificationChanged),
            () => room.off(RoomEvent.Redaction, this.onNotificationChanged),
            () => room.off(RoomEvent.LocalEchoUpdated, this.onNotificationChanged),
            () => room.off(RoomEvent.MyMembership, this.onNotificationChanged),
        ];
    }

    private detachRoomListeners(): void {
        for (const dispose of this.roomListenerDisposers) {
            dispose();
        }
        this.roomListenerDisposers = [];
    }

    private readonly onRoomUnreadNotifications = (
        _unreadNotifications?: NotificationCount,
        evtThreadId?: string,
    ): void => {
        if (this.props.threadId && this.props.threadId !== evtThreadId) return;
        this.updateSnapshotFromProps();
    };

    private readonly onNotificationChanged = (): void => {
        this.updateSnapshotFromProps();
    };

    private readonly onHideBoldSettingChanged = (): void => {
        this.setHideBold(SettingsStore.getValue("feature_hidebold"));
    };
}
