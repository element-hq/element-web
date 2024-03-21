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

import React, { ReactElement, ReactNode } from "react";

import { StaticNotificationState } from "../../stores/notifications/StaticNotificationState";
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
