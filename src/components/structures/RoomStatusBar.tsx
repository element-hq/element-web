/*
Copyright (c) 2025 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { RestartIcon, WarningIcon, DeleteIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t, _td } from "../../languageHandler";
import { StaticNotificationState } from "../../stores/notifications/StaticNotificationState";
import AccessibleButton from "../views/elements/AccessibleButton";
import InlineSpinner from "../views/elements/InlineSpinner";
import { RoomStatusBarUnsentMessages } from "./RoomStatusBarUnsentMessages";
import { useRoomStatusBarViewModel } from "../viewmodels/rooms/RoomStatusBarViewModel";

interface IProps {
    // the room this statusbar is representing.
    room: Room;
}

export function RoomStatusBar(props: IProps) {
    const vm = useRoomStatusBarViewModel(props);
    if (!vm.visible) {
        return null;
    }
    if ("connectivityLost" in vm) {
        return (
            <div className="mx_RoomStatusBar">
                <div role="alert">
                    <div className="mx_RoomStatusBar_connectionLostBar">
                        <WarningIcon width="24px" height="24px" />
                        <div>
                            <div className="mx_RoomStatusBar_connectionLostBar_title">
                                {_t("room|status_bar|server_connectivity_lost_title")}
                            </div>
                            <div className="mx_RoomStatusBar_connectionLostBar_desc">
                                {_t("room|status_bar|server_connectivity_lost_description")}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (vm.isResending) {
        return (
            <RoomStatusBarUnsentMessages
                title={vm.title}
                description={vm.description}
                notificationState={StaticNotificationState.RED_EXCLAMATION}
                buttons={
                    <>
                        <InlineSpinner w={20} h={20} />
                        {/* span for css */}
                        <span>{_t("forward|sending")}</span>
                    </>
                }
            />
        );
    }

    return (
        <RoomStatusBarUnsentMessages
            title={vm.title}
            description={vm.description}
            notificationState={StaticNotificationState.RED_EXCLAMATION}
            buttons={
                <>
                    {vm.onCancelAllClick && (
                        <AccessibleButton onClick={vm.onCancelAllClick}>
                            <DeleteIcon />
                            {_t("room|status_bar|delete_all")}
                        </AccessibleButton>
                    )}
                    {vm.onResendAllClick && (
                        <AccessibleButton onClick={vm.onResendAllClick}>
                            <RestartIcon />
                            {_t("room|status_bar|retry_all")}
                        </AccessibleButton>
                    )}
                </>
            }
        />
    );
}
