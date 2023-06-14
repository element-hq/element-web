/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { MouseEvent, ReactNode } from "react";

import SettingsStore from "../../../settings/SettingsStore";
import { XOR } from "../../../@types/common";
import { NotificationState, NotificationStateEvents } from "../../../stores/notifications/NotificationState";
import Tooltip from "../elements/Tooltip";
import { _t } from "../../../languageHandler";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";
import { StatelessNotificationBadge } from "./NotificationBadge/StatelessNotificationBadge";

interface IProps {
    notification: NotificationState;

    /**
     * If true, the badge will show a count if at all possible. This is typically
     * used to override the user's preference for things like room sublists.
     */
    forceCount?: boolean;

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
    showCounts: boolean; // whether or not to show counts. Independent of props.forceCount
    showTooltip: boolean;
}

export default class NotificationBadge extends React.PureComponent<XOR<IProps, IClickableProps>, IState> {
    private countWatcherRef: string;

    public constructor(props: IProps) {
        super(props);
        this.props.notification.on(NotificationStateEvents.Update, this.onNotificationUpdate);

        this.state = {
            showCounts: SettingsStore.getValue("Notifications.alwaysShowBadgeCounts", this.roomId),
            showTooltip: false,
        };

        this.countWatcherRef = SettingsStore.watchSetting(
            "Notifications.alwaysShowBadgeCounts",
            this.roomId,
            this.countPreferenceChanged,
        );
    }

    private get roomId(): string | null {
        // We should convert this to null for safety with the SettingsStore
        return this.props.roomId || null;
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

    private onMouseOver = (e: MouseEvent): void => {
        e.stopPropagation();
        this.setState({
            showTooltip: true,
        });
    };

    private onMouseLeave = (): void => {
        this.setState({
            showTooltip: false,
        });
    };

    public render(): ReactNode {
        /* eslint @typescript-eslint/no-unused-vars: ["error", { "ignoreRestSiblings": true }] */
        const { notification, showUnsentTooltip, forceCount, onClick, tabIndex } = this.props;

        if (notification.isIdle) return null;
        if (forceCount) {
            if (!notification.hasUnreadCount) return null; // Can't render a badge
        }

        let label: string | undefined;
        let tooltip: JSX.Element | undefined;
        if (showUnsentTooltip && this.state.showTooltip && notification.color === NotificationColor.Unsent) {
            label = _t("Message didn't send. Click for info.");
            tooltip = <Tooltip className="mx_NotificationBadge_tooltip" label={label} />;
        }

        const commonProps: React.ComponentProps<typeof StatelessNotificationBadge> = {
            label,
            symbol: notification.symbol,
            count: notification.count,
            color: notification.color,
            onMouseOver: this.onMouseOver,
            onMouseLeave: this.onMouseLeave,
        };

        if (onClick) {
            return (
                <StatelessNotificationBadge {...commonProps} onClick={onClick} tabIndex={tabIndex}>
                    {tooltip}
                </StatelessNotificationBadge>
            );
        }

        return <StatelessNotificationBadge {...commonProps}>{tooltip}</StatelessNotificationBadge>;
    }
}
