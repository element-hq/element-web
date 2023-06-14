/*
Copyright 2020 - 2023 The Matrix.org Foundation C.I.C.

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

import { RovingAccessibleButton, RovingAccessibleTooltipButton } from "../../../accessibility/RovingTabIndex";
import NotificationBadge from "./NotificationBadge";
import { NotificationState } from "../../../stores/notifications/NotificationState";
import { ButtonEvent } from "../elements/AccessibleButton";
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
        badge = <NotificationBadge notification={notificationState} forceCount={false} />;
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

    let Button = RovingAccessibleButton;
    if (isMinimized) {
        Button = RovingAccessibleTooltipButton;
    }

    return (
        <Button
            className={classes}
            onMouseEnter={onMouseOver}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            role="treeitem"
            title={isMinimized ? name : undefined}
        >
            <div className="mx_RoomTile_avatarContainer">{avatar}</div>
            <div className="mx_RoomTile_details">
                <div className="mx_RoomTile_primaryDetails">
                    {nameContainer}
                    <div className="mx_RoomTile_badgeContainer">{badge}</div>
                </div>
            </div>
        </Button>
    );
}
