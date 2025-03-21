/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import { type Room } from "matrix-js-sdk/src/matrix";
import React, { type JSX, Fragment, useState } from "react";

import { ContextMenuTooltipButton } from "../../../../accessibility/context_menu/ContextMenuTooltipButton";
import { useNotificationState } from "../../../../hooks/useRoomNotificationState";
import { _t } from "../../../../languageHandler";
import { RoomNotifState } from "../../../../RoomNotifs";
import { RoomGeneralContextMenu } from "../../context_menus/RoomGeneralContextMenu";
import { RoomNotificationContextMenu } from "../../context_menus/RoomNotificationContextMenu";
import SpaceContextMenu from "../../context_menus/SpaceContextMenu";
import { type ButtonEvent } from "../../elements/AccessibleButton";
import { contextMenuBelow } from "../../rooms/RoomTile";
import { shouldShowComponent } from "../../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../../settings/UIFeature";

interface Props {
    room: Room;
}

export function RoomResultContextMenus({ room }: Props): JSX.Element {
    const [notificationState] = useNotificationState(room);

    const [generalMenuPosition, setGeneralMenuPosition] = useState<DOMRect | null>(null);
    const [notificationMenuPosition, setNotificationMenuPosition] = useState<DOMRect | null>(null);

    let generalMenu: JSX.Element | undefined;
    if (generalMenuPosition !== null) {
        if (room.isSpaceRoom()) {
            generalMenu = (
                <SpaceContextMenu
                    {...contextMenuBelow(generalMenuPosition)}
                    space={room}
                    onFinished={() => setGeneralMenuPosition(null)}
                />
            );
        } else {
            generalMenu = (
                <RoomGeneralContextMenu
                    {...contextMenuBelow(generalMenuPosition)}
                    room={room}
                    onFinished={() => setGeneralMenuPosition(null)}
                />
            );
        }
    }

    let notificationMenu: JSX.Element | undefined;
    if (notificationMenuPosition !== null) {
        notificationMenu = (
            <RoomNotificationContextMenu
                {...contextMenuBelow(notificationMenuPosition)}
                room={room}
                onFinished={() => setNotificationMenuPosition(null)}
            />
        );
    }

    const notificationMenuClasses = classNames("mx_SpotlightDialog_option--notifications", {
        // Show bell icon for the default case too.
        mx_RoomNotificationContextMenu_iconBell: notificationState === RoomNotifState.AllMessages,
        mx_RoomNotificationContextMenu_iconBellDot: notificationState === RoomNotifState.AllMessagesLoud,
        mx_RoomNotificationContextMenu_iconBellMentions: notificationState === RoomNotifState.MentionsOnly,
        mx_RoomNotificationContextMenu_iconBellCrossed: notificationState === RoomNotifState.Mute,
    });

    return (
        <Fragment>
            {shouldShowComponent(UIComponent.RoomOptionsMenu) && (
                <ContextMenuTooltipButton
                    className="mx_SpotlightDialog_option--menu"
                    onClick={(ev: ButtonEvent) => {
                        ev.preventDefault();
                        ev.stopPropagation();

                        const target = ev.target as HTMLElement;
                        setGeneralMenuPosition(target.getBoundingClientRect());
                    }}
                    title={room.isSpaceRoom() ? _t("space|context_menu|options") : _t("room|context_menu|title")}
                    isExpanded={generalMenuPosition !== null}
                />
            )}
            {!room.isSpaceRoom() && (
                <ContextMenuTooltipButton
                    className={notificationMenuClasses}
                    onClick={(ev: ButtonEvent) => {
                        ev.preventDefault();
                        ev.stopPropagation();

                        const target = ev.target as HTMLElement;
                        setNotificationMenuPosition(target.getBoundingClientRect());
                    }}
                    title={_t("room_list|notification_options")}
                    isExpanded={notificationMenuPosition !== null}
                />
            )}
            {generalMenu}
            {notificationMenu}
        </Fragment>
    );
}
