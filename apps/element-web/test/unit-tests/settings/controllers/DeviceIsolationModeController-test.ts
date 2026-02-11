/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { AllDevicesIsolationMode, OnlySignedDevicesIsolationMode } from "matrix-js-sdk/src/crypto-api";

import { stubClient } from "../../../test-utils";
import DeviceIsolationModeController from "../../../../src/settings/controllers/DeviceIsolationModeController.ts";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

describe("DeviceIsolationModeController", () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    describe("tracks enabling and disabling", () => {
        it("on sets signed device isolation mode", () => {
            const cli = stubClient();
            const controller = new DeviceIsolationModeController();
            controller.onChange(SettingLevel.DEVICE, "", true);
            expect(cli.getCrypto()?.setDeviceIsolationMode).toHaveBeenCalledWith(new OnlySignedDevicesIsolationMode());
        });

        it("off sets all device isolation mode", () => {
            const cli = stubClient();
            const controller = new DeviceIsolationModeController();
            controller.onChange(SettingLevel.DEVICE, "", false);
            expect(cli.getCrypto()?.setDeviceIsolationMode).toHaveBeenCalledWith(new AllDevicesIsolationMode(false));
        });
    });
});
