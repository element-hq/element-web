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
    const cli = MatrixClientPeg.get();

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
        title: _t("New login. Was this you?"),
        icon: "verification_warning",
        props: {
            description: device.display_name,
            detail: <DeviceMetaData device={extendedDevice} />,
            acceptLabel: _t("Yes, it was me"),
            onAccept,
            rejectLabel: _t("No"),
            onReject,
        },
        component: GenericToast,
        priority: 80,
    });
};

export const hideToast = (deviceId: string): void => {
    ToastStore.sharedInstance().dismissToast(toastKey(deviceId));
};
