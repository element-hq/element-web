/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { forwardRef } from "react";
import classNames from "classnames";

import { formatCount } from "../../../../utils/FormattingUtils";
import AccessibleButton, { ButtonEvent } from "../../elements/AccessibleButton";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { useSettingValue } from "../../../../hooks/useSettings";
import { XOR } from "../../../../@types/common";

interface Props {
    symbol: string | null;
    count: number;
    level: NotificationLevel;
    knocked?: boolean;
    type?: "badge" | "dot";
}

interface ClickableProps extends Props {
    /**
     * If specified will return an AccessibleButton instead of a div.
     */
    onClick(ev: ButtonEvent): void;
    tabIndex?: number;
}

export const StatelessNotificationBadge = forwardRef<HTMLDivElement, XOR<Props, ClickableProps>>(
    ({ symbol, count, level, knocked, type = "badge", ...props }, ref) => {
        const hideBold = useSettingValue("feature_hidebold");

        // Don't show a badge if we don't need to
        if ((level === NotificationLevel.None || (hideBold && level == NotificationLevel.Activity)) && !knocked) {
            return <></>;
        }

        const hasUnreadCount = level >= NotificationLevel.Notification && (!!count || !!symbol);

        const isEmptyBadge = symbol === null && count === 0;

        if (symbol === null && count > 0) {
            symbol = formatCount(count);
        }

        const classes = classNames({
            mx_NotificationBadge: true,
            mx_NotificationBadge_visible: isEmptyBadge || knocked ? true : hasUnreadCount,
            mx_NotificationBadge_highlighted: level >= NotificationLevel.Highlight,
            mx_NotificationBadge_dot: (isEmptyBadge && !knocked) || type === "dot",
            mx_NotificationBadge_knocked: knocked,
            mx_NotificationBadge_2char: type === "badge" && symbol && symbol.length > 0 && symbol.length < 3,
            mx_NotificationBadge_3char: type === "badge" && symbol && symbol.length > 2,
        });

        if (props.onClick) {
            return (
                <AccessibleButton {...props} className={classes} onClick={props.onClick} ref={ref}>
                    <span className="mx_NotificationBadge_count">{symbol}</span>
                    {props.children}
                </AccessibleButton>
            );
        }

        return (
            <div className={classes} ref={ref}>
                <span className="mx_NotificationBadge_count">{symbol}</span>
            </div>
        );
    },
);
