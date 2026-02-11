/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { AllDevicesIsolationMode, OnlySignedDevicesIsolationMode } from "matrix-js-sdk/src/crypto-api";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import SettingController from "./SettingController";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { type SettingLevel } from "../SettingLevel";

/**
 * A controller for the "exclude_insecure_devices" setting, which will
 * update the crypto stack's device isolation mode on change.
 */
export default class DeviceIsolationModeController extends SettingController {
    public onChange(level: SettingLevel, roomId: string, newValue: any): void {
        setDeviceIsolationMode(MatrixClientPeg.safeGet(), newValue);
    }
}

/**
 * Set the crypto stack's device isolation mode based on the current value of the
 * "exclude_insecure_devices" setting.
 *
 * @param client - MatrixClient to update to the new setting.
 * @param settingValue - value of the "exclude_insecure_devices" setting.
 */
export function setDeviceIsolationMode(client: MatrixClient, settingValue: boolean): void {
    client.getCrypto()?.setDeviceIsolationMode(
        settingValue
            ? new OnlySignedDevicesIsolationMode()
            : // TODO: As part of https://github.com/element-hq/element-meta/issues/2492, we will change
              //   `errorOnVerifiedUserProblems` to `true`, but we need to have better UI in place before we can do so.
              new AllDevicesIsolationMode(false),
    );
}
