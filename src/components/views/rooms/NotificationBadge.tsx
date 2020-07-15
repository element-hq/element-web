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

import React from "react";
import classNames from "classnames";
import { formatMinimalBadgeCount } from "../../../utils/FormattingUtils";
import SettingsStore from "../../../settings/SettingsStore";
import AccessibleButton from "../elements/AccessibleButton";
import { XOR } from "../../../@types/common";
import { NOTIFICATION_STATE_UPDATE, NotificationState } from "../../../stores/notifications/NotificationState";

interface IProps {
    notification: NotificationState;

    /**
     * If true, the badge will show a count if at all possible. This is typically
     * used to override the user's preference for things like room sublists.
     */
    forceCount: boolean;

    /**
     * The room ID, if any, the badge represents.
     */
    roomId?: string;
}

interface IClickableProps extends IProps, React.InputHTMLAttributes<Element> {
    /**
     * If specified will return an AccessibleButton instead of a div.
     */
    onClick?(ev: React.MouseEvent);
}

interface IState {
    showCounts: boolean; // whether or not to show counts. Independent of props.forceCount
}

export default class NotificationBadge extends React.PureComponent<XOR<IProps, IClickableProps>, IState> {
    private countWatcherRef: string;

    constructor(props: IProps) {
        super(props);
        this.props.notification.on(NOTIFICATION_STATE_UPDATE, this.onNotificationUpdate);

        this.state = {
            showCounts: SettingsStore.getValue("Notifications.alwaysShowBadgeCounts", this.roomId),
        };

        this.countWatcherRef = SettingsStore.watchSetting(
            "Notifications.alwaysShowBadgeCounts", this.roomId,
            this.countPreferenceChanged,
        );
    }

    private get roomId(): string {
        // We should convert this to null for safety with the SettingsStore
        return this.props.roomId || null;
    }

    public componentWillUnmount() {
        SettingsStore.unwatchSetting(this.countWatcherRef);
    }

    public componentDidUpdate(prevProps: Readonly<IProps>) {
        if (prevProps.notification) {
            prevProps.notification.off(NOTIFICATION_STATE_UPDATE, this.onNotificationUpdate);
        }

        this.props.notification.on(NOTIFICATION_STATE_UPDATE, this.onNotificationUpdate);
    }

    private countPreferenceChanged = () => {
        this.setState({showCounts: SettingsStore.getValue("Notifications.alwaysShowBadgeCounts", this.roomId)});
    };

    private onNotificationUpdate = () => {
        this.forceUpdate(); // notification state changed - update
    };

    public render(): React.ReactElement {
        const {notification, forceCount, roomId, onClick, ...props} = this.props;

        // Don't show a badge if we don't need to
        if (notification.isIdle) return null;

        // TODO: Update these booleans for FTUE Notifications: https://github.com/vector-im/riot-web/issues/14261
        // As of writing, that is "if red, show count always" and "optionally show counts instead of dots".
        // See git diff for what that boolean state looks like.
        // XXX: We ignore this.state.showCounts (the setting which controls counts vs dots).
        const hasAnySymbol = notification.symbol || notification.count > 0;
        let isEmptyBadge = !hasAnySymbol || !notification.hasUnreadCount;
        if (forceCount) {
            isEmptyBadge = false;
            if (!notification.hasUnreadCount) return null; // Can't render a badge
        }

        let symbol = notification.symbol || formatMinimalBadgeCount(notification.count);
        if (isEmptyBadge) symbol = "";

        const classes = classNames({
            'mx_NotificationBadge': true,
            'mx_NotificationBadge_visible': isEmptyBadge ? true : notification.hasUnreadCount,
            'mx_NotificationBadge_highlighted': notification.hasMentions,
            'mx_NotificationBadge_dot': isEmptyBadge,
            'mx_NotificationBadge_2char': symbol.length > 0 && symbol.length < 3,
            'mx_NotificationBadge_3char': symbol.length > 2,
        });

        if (onClick) {
            return (
                <AccessibleButton {...props} className={classes} onClick={onClick}>
                    <span className="mx_NotificationBadge_count">{symbol}</span>
                </AccessibleButton>
            );
        }

        return (
            <div className={classes}>
                <span className="mx_NotificationBadge_count">{symbol}</span>
            </div>
        );
    }
}
