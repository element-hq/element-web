/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import { Tooltip } from "@vector-im/compound-web";

import SettingsStore from "../../../settings/SettingsStore";
import { type XOR } from "../../../@types/common";
import { type NotificationState, NotificationStateEvents } from "../../../stores/notifications/NotificationState";
import { _t } from "../../../languageHandler";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { StatelessNotificationBadge } from "./NotificationBadge/StatelessNotificationBadge";

interface IProps {
    notification: NotificationState;

    /**
     * If true, show nothing if the notification would only cause a dot to be shown rather than
     * a badge. That is: only display badges and not dots. Default: false.
     */
    hideIfDot?: boolean;

    /**
     * The room ID, if any, the badge represents.
     */
    roomId?: string;
}

interface IClickableProps extends IProps, React.InputHTMLAttributes<Element> {
    showUnsentTooltip?: boolean;
    /**
     * If specified will return an AccessibleButton instead of a div.
     */
    onClick(ev: React.MouseEvent): void;
}

interface IState {
    showCounts: boolean; // whether to show counts.
}

export default class NotificationBadge extends React.PureComponent<XOR<IProps, IClickableProps>, IState> {
    private countWatcherRef?: string;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            showCounts: SettingsStore.getValue("Notifications.alwaysShowBadgeCounts", this.roomId),
        };
    }

    private get roomId(): string | null {
        // We should convert this to null for safety with the SettingsStore
        return this.props.roomId || null;
    }

    public componentDidMount(): void {
        this.props.notification.on(NotificationStateEvents.Update, this.onNotificationUpdate);

        this.countWatcherRef = SettingsStore.watchSetting(
            "Notifications.alwaysShowBadgeCounts",
            this.roomId,
            this.countPreferenceChanged,
        );
    }

    public componentWillUnmount(): void {
        SettingsStore.unwatchSetting(this.countWatcherRef);
        this.props.notification.off(NotificationStateEvents.Update, this.onNotificationUpdate);
    }

    public componentDidUpdate(prevProps: Readonly<IProps>): void {
        if (prevProps.notification) {
            prevProps.notification.off(NotificationStateEvents.Update, this.onNotificationUpdate);
        }

        this.props.notification.on(NotificationStateEvents.Update, this.onNotificationUpdate);
    }

    private countPreferenceChanged = (): void => {
        this.setState({ showCounts: SettingsStore.getValue("Notifications.alwaysShowBadgeCounts", this.roomId) });
    };

    private onNotificationUpdate = (): void => {
        this.forceUpdate(); // notification state changed - update
    };

    public render(): ReactNode {
        /* eslint @typescript-eslint/no-unused-vars: ["error", { "ignoreRestSiblings": true }] */
        const { notification, showUnsentTooltip, hideIfDot, onClick, tabIndex } = this.props;

        if (notification.isIdle && !notification.knocked) return null;
        if (hideIfDot && notification.level < NotificationLevel.Notification) {
            // This would just be a dot and we've been told not to show dots, so don't show it
            return null;
        }

        const commonProps: React.ComponentProps<typeof StatelessNotificationBadge> = {
            symbol: notification.symbol,
            count: notification.count,
            level: notification.level,
            knocked: notification.knocked,
        };

        let badge: JSX.Element;
        if (onClick) {
            badge = <StatelessNotificationBadge {...commonProps} onClick={onClick} tabIndex={tabIndex} />;
        } else {
            badge = <StatelessNotificationBadge {...commonProps} />;
        }

        if (showUnsentTooltip && notification.level === NotificationLevel.Unsent) {
            return (
                <Tooltip label={_t("notifications|message_didnt_send")} placement="right">
                    {badge}
                </Tooltip>
            );
        }

        return badge;
    }
}
