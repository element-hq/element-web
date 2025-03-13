/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement, type ReactNode } from "react";

import { type StaticNotificationState } from "../../stores/notifications/StaticNotificationState";
import NotificationBadge from "../views/rooms/NotificationBadge";

interface RoomStatusBarUnsentMessagesProps {
    title: ReactNode;
    description?: string;
    notificationState: StaticNotificationState;
    buttons: ReactElement;
}

export const RoomStatusBarUnsentMessages = (props: RoomStatusBarUnsentMessagesProps): ReactElement => {
    return (
        <div className="mx_RoomStatusBar mx_RoomStatusBar_unsentMessages">
            <div role="alert">
                <div className="mx_RoomStatusBar_unsentBadge">
                    <NotificationBadge notification={props.notificationState} />
                </div>
                <div>
                    <div className="mx_RoomStatusBar_unsentTitle">{props.title}</div>
                    {props.description && <div className="mx_RoomStatusBar_unsentDescription">{props.description}</div>}
                </div>
                <div className="mx_RoomStatusBar_unsentButtonBar">{props.buttons}</div>
            </div>
        </div>
    );
};
