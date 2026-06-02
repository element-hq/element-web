/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type NotificationCount, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type NotificationBadgeViewSnapshot,
    type NotificationBadgeViewModel as NotificationBadgeViewModelInterface,
} from "@element-hq/web-shared-components";

import { determineUnreadState } from "../../../RoomNotifs";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import SettingsStore from "../../../settings/SettingsStore";
import { formatCount } from "../../../utils/FormattingUtils";

export interface UnreadNotificationBadgeViewModelProps {
    room?: Room;
    threadId?: string;
    forceDot?: boolean;
}

interface InternalProps extends UnreadNotificationBadgeViewModelProps {
    hideBold: boolean;
}

export class UnreadNotificationBadgeViewModel
    extends BaseViewModel<NotificationBadgeViewSnapshot, InternalProps>
    implements NotificationBadgeViewModelInterface
{
    private listenerCleanups: Array<() => void> = [];

    private static readonly computeSnapshot = (props: InternalProps): NotificationBadgeViewSnapshot => {
        const { symbol, count, level } = determineUnreadState(props.room, props.threadId, false);
        const shouldRender =
            level !== NotificationLevel.None && !(props.hideBold && level === NotificationLevel.Activity);
        const hasUnreadCount = level >= NotificationLevel.Notification && (!!count || !!symbol);
        const isEmptyBadge = symbol === null && count === 0;

        let displaySymbol = symbol;
        if (displaySymbol === null && count > 0) {
            displaySymbol = formatCount(count);
        }

        const badgeType =
            props.forceDot || level <= NotificationLevel.Activity
                ? "dot"
                : !displaySymbol || displaySymbol.length < 3
                  ? "badge_2char"
                  : "badge_3char";

        return {
            shouldRender,
            isVisible: isEmptyBadge ? true : hasUnreadCount,
            isNotification: level === NotificationLevel.Notification,
            isHighlight: level >= NotificationLevel.Highlight,
            isKnocked: false,
            badgeType,
            symbol: displaySymbol,
        };
    };

    public constructor(props: UnreadNotificationBadgeViewModelProps) {
        const internalProps: InternalProps = {
            ...props,
            hideBold: SettingsStore.getValue("feature_hidebold"),
        };

        super(internalProps, UnreadNotificationBadgeViewModel.computeSnapshot(internalProps));

        this.setupListeners();

        const hideBoldWatcherRef = SettingsStore.watchSetting("feature_hidebold", null, this.onHideBoldSettingChanged);
        this.disposables.track(() => SettingsStore.unwatchSetting(hideBoldWatcherRef));
    }

    public dispose(): void {
        this.teardownListeners();
        super.dispose();
    }

    public setRoom(room?: Room): void {
        if (this.props.room === room) return;

        this.props = {
            ...this.props,
            room,
        };
        this.setupListeners();
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

    private setupListeners(): void {
        this.teardownListeners();

        const { room } = this.props;
        if (!room) return;

        room.on(RoomEvent.UnreadNotifications, this.onRoomUnreadNotifications);
        room.on(RoomEvent.Receipt, this.onNotificationChanged);
        room.on(RoomEvent.Timeline, this.onNotificationChanged);
        room.on(RoomEvent.Redaction, this.onNotificationChanged);
        room.on(RoomEvent.LocalEchoUpdated, this.onNotificationChanged);
        room.on(RoomEvent.MyMembership, this.onNotificationChanged);

        this.listenerCleanups.push(() => {
            room.off(RoomEvent.UnreadNotifications, this.onRoomUnreadNotifications);
            room.off(RoomEvent.Receipt, this.onNotificationChanged);
            room.off(RoomEvent.Timeline, this.onNotificationChanged);
            room.off(RoomEvent.Redaction, this.onNotificationChanged);
            room.off(RoomEvent.LocalEchoUpdated, this.onNotificationChanged);
            room.off(RoomEvent.MyMembership, this.onNotificationChanged);
        });
    }

    private teardownListeners(): void {
        for (const cleanup of this.listenerCleanups) {
            cleanup();
        }
        this.listenerCleanups = [];
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
