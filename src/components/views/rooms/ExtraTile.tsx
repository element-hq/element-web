/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";

import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";
import NotificationBadge from "./NotificationBadge";
import { type NotificationState } from "../../../stores/notifications/NotificationState";
import { type ButtonEvent } from "../elements/AccessibleButton";
import useHover from "../../../hooks/useHover";

interface ExtraTileProps {
    isMinimized: boolean;
    isSelected: boolean;
    displayName: string;
    avatar: React.ReactElement;
    notificationState?: NotificationState;
    onClick: (ev: ButtonEvent) => void;
}

export default function ExtraTile({
    isSelected,
    isMinimized,
    notificationState,
    displayName,
    onClick,
    avatar,
}: ExtraTileProps): JSX.Element {
    const [, { onMouseOver, onMouseLeave }] = useHover(() => false);

    // XXX: We copy classes because it's easier
    const classes = classNames({
        mx_ExtraTile: true,
        mx_RoomTile: true,
        mx_RoomTile_selected: isSelected,
        mx_RoomTile_minimized: isMinimized,
    });

    let badge: JSX.Element | null = null;
    if (notificationState) {
        badge = <NotificationBadge notification={notificationState} />;
    }

    let name = displayName;
    if (typeof name !== "string") name = "";
    name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon

    const nameClasses = classNames({
        mx_RoomTile_title: true,
        mx_RoomTile_titleHasUnreadEvents: notificationState?.isUnread,
    });

    let nameContainer: JSX.Element | null = (
        <div className="mx_RoomTile_titleContainer">
            <div title={name} className={nameClasses} tabIndex={-1} dir="auto">
                {name}
            </div>
        </div>
    );
    if (isMinimized) nameContainer = null;

    return (
        <RovingAccessibleButton
            className={classes}
            onMouseEnter={onMouseOver}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            role="treeitem"
            title={name}
            disableTooltip={!isMinimized}
        >
            <div className="mx_RoomTile_avatarContainer">{avatar}</div>
            <div className="mx_RoomTile_details">
                <div className="mx_RoomTile_primaryDetails">
                    {nameContainer}
                    <div className="mx_RoomTile_badgeContainer">{badge}</div>
                </div>
            </div>
        </RovingAccessibleButton>
    );
}
