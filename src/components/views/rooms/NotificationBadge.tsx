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

import React, { MouseEvent } from "react";
import classNames from "classnames";

import { formatCount } from "../../../utils/FormattingUtils";
import SettingsStore from "../../../settings/SettingsStore";
import AccessibleButton from "../elements/AccessibleButton";
import { XOR } from "../../../@types/common";
import { NotificationState, NotificationStateEvents } from "../../../stores/notifications/NotificationState";
import Tooltip from "../elements/Tooltip";
import { _t } from "../../../languageHandler";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";

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
    onClick?(ev: React.MouseEvent);
}

interface IState {
    showCounts: boolean; // whether or not to show counts. Independent of props.forceCount
    showTooltip: boolean;
}

export default class NotificationBadge extends React.PureComponent<XOR<IProps, IClickableProps>, IState> {
    private countWatcherRef: string;

    constructor(props: IProps) {
        super(props);
        this.props.notification.on(NotificationStateEvents.Update, this.onNotificationUpdate);

        this.state = {
            showCounts: SettingsStore.getValue("Notifications.alwaysShowBadgeCounts", this.roomId),
            showTooltip: false,
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
        this.props.notification.off(NotificationStateEvents.Update, this.onNotificationUpdate);
    }

    public componentDidUpdate(prevProps: Readonly<IProps>) {
        if (prevProps.notification) {
            prevProps.notification.off(NotificationStateEvents.Update, this.onNotificationUpdate);
        }

        this.props.notification.on(NotificationStateEvents.Update, this.onNotificationUpdate);
    }

    private countPreferenceChanged = () => {
        this.setState({ showCounts: SettingsStore.getValue("Notifications.alwaysShowBadgeCounts", this.roomId) });
    };

    private onNotificationUpdate = () => {
        this.forceUpdate(); // notification state changed - update
    };

    private onMouseOver = (e: MouseEvent) => {
        e.stopPropagation();
        this.setState({
            showTooltip: true,
        });
    };

    private onMouseLeave = () => {
        this.setState({
            showTooltip: false,
        });
    };

    public render(): React.ReactElement {
        /* eslint @typescript-eslint/no-unused-vars: ["error", { "ignoreRestSiblings": true }] */
        const { notification, showUnsentTooltip, forceCount, roomId, onClick, ...props } = this.props;

        // Don't show a badge if we don't need to
        if (notification.isIdle) return null;

        // TODO: Update these booleans for FTUE Notifications: https://github.com/vector-im/element-web/issues/14261
        // As of writing, that is "if red, show count always" and "optionally show counts instead of dots".
        // See git diff for what that boolean state looks like.
        // XXX: We ignore this.state.showCounts (the setting which controls counts vs dots).
        const hasAnySymbol = notification.symbol || notification.count > 0;
        let isEmptyBadge = !hasAnySymbol || !notification.hasUnreadCount;
        if (forceCount) {
            isEmptyBadge = false;
            if (!notification.hasUnreadCount) return null; // Can't render a badge
        }

        let symbol = notification.symbol || formatCount(notification.count);
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
            let label: string;
            let tooltip: JSX.Element;
            if (showUnsentTooltip && this.state.showTooltip && notification.color === NotificationColor.Unsent) {
                label = _t("Message didn't send. Click for info.");
                tooltip = <Tooltip className="mx_RoleButton_tooltip" label={label} />;
            }

            return (
                <AccessibleButton
                    aria-label={label}
                    {...props}
                    className={classes}
                    onClick={onClick}
                    onMouseOver={this.onMouseOver}
                    onMouseLeave={this.onMouseLeave}
                >
                    <span className="mx_NotificationBadge_count">{ symbol }</span>
                    { tooltip }
                </AccessibleButton>
            );
        }

        return (
            <div className={classes}>
                <span className="mx_NotificationBadge_count">{ symbol }</span>
            </div>
        );
    }
}
