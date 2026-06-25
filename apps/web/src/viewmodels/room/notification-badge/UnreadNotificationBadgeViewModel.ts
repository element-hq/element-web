/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type NotificationCount, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type NotificationBadgeType,
    type NotificationBadgeViewSnapshot,
    type NotificationBadgeViewModel as NotificationBadgeViewModelInterface,
} from "@element-hq/web-shared-components";

import { determineUnreadState } from "../../../RoomNotifs";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import SettingsStore from "../../../settings/SettingsStore";
import { formatCount } from "../../../utils/FormattingUtils";

const notificationChangeEvents = [
    RoomEvent.Receipt,
    RoomEvent.Timeline,
    RoomEvent.Redaction,
    RoomEvent.LocalEchoUpdated,
    RoomEvent.MyMembership,
];

function getBadgeType(level: NotificationLevel, symbol: string | null, forceDot?: boolean): NotificationBadgeType {
    if (forceDot || level <= NotificationLevel.Activity) {
        return "dot";
    }

    return symbol && symbol.length >= 3 ? "badge_3char" : "badge_2char";
}

export interface UnreadNotificationBadgeViewModelProps {
    /**
     * Room whose unread state should be represented by the badge.
     */
    room?: Room;
    /**
     * Thread to read unread state from. Omit for room-level unread state.
     */
    threadId?: string;
    /**
     * Show a dot instead of a numeric/symbol badge whenever the badge would otherwise render.
     */
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
        const displaySymbol = symbol ?? (count > 0 ? formatCount(count) : null);
        const hasUnreadCount = level >= NotificationLevel.Notification && (count > 0 || symbol !== null);
        const isSuppressedActivity = props.hideBold && level === NotificationLevel.Activity;

        return {
            shouldRender: level !== NotificationLevel.None && !isSuppressedActivity,
            isVisible: symbol === null && count === 0 ? true : hasUnreadCount,
            isNotification: level === NotificationLevel.Notification,
            isHighlight: level >= NotificationLevel.Highlight,
            isKnocked: false,
            badgeType: getBadgeType(level, displaySymbol, props.forceDot),
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
        for (const eventName of notificationChangeEvents) {
            room.on(eventName, this.onNotificationChanged);
        }

        this.listenerCleanups.push(() => {
            room.off(RoomEvent.UnreadNotifications, this.onRoomUnreadNotifications);
            for (const eventName of notificationChangeEvents) {
                room.off(eventName, this.onNotificationChanged);
            }
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
