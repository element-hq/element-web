/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../languageHandler";
import dis from "../dispatcher/dispatcher";
import { MatrixClientPeg } from "../MatrixClientPeg";
import DeviceListener from "../DeviceListener";
import ToastStore from "../stores/ToastStore";
import GenericToast from "../components/views/toasts/GenericToast";
import { Action } from "../dispatcher/actions";
import { isDeviceVerified } from "../utils/device/isDeviceVerified";
import { DeviceType } from "../utils/device/parseUserAgent";
import { DeviceMetaData } from "../components/views/settings/devices/DeviceMetaData";

function toastKey(deviceId: string): string {
    return "unverified_session_" + deviceId;
}

export const showToast = async (deviceId: string): Promise<void> => {
    const cli = MatrixClientPeg.safeGet();

    const onAccept = (): void => {
        DeviceListener.sharedInstance().dismissUnverifiedSessions([deviceId]);
    };

    const onReject = (): void => {
        DeviceListener.sharedInstance().dismissUnverifiedSessions([deviceId]);
        dis.dispatch({
            action: Action.ViewUserDeviceSettings,
        });
    };

    const device = await cli.getDevice(deviceId);
    const extendedDevice = {
        ...device,
        isVerified: await isDeviceVerified(cli, deviceId),
        deviceType: DeviceType.Unknown,
    };

    ToastStore.sharedInstance().addOrReplaceToast({
        key: toastKey(deviceId),
        title: _t("encryption|verification|unverified_session_toast_title"),
        icon: "verification_warning",
        props: {
            description: device.display_name,
            detail: <DeviceMetaData device={extendedDevice} />,
            primaryLabel: _t("encryption|verification|unverified_session_toast_accept"),
            onPrimaryClick: onAccept,
            secondaryLabel: _t("action|no"),
            onSecondaryClick: onReject,
            destructive: "secondary",
        },
        component: GenericToast,
        priority: 80,
    });
};

export const hideToast = (deviceId: string): void => {
    ToastStore.sharedInstance().dismissToast(toastKey(deviceId));
};
