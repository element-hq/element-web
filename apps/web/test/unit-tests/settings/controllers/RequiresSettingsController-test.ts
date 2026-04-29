/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Capabilities } from "matrix-js-sdk/src/matrix";
import RequiresSettingsController from "../../../../src/settings/controllers/RequiresSettingsController";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import SettingsStore from "../../../../src/settings/SettingsStore";
import MatrixClientBackedController from "../../../../src/settings/controllers/MatrixClientBackedController";
import { getMockClientWithEventEmitter, mockClientMethodsServer } from "../../../test-utils";

describe("RequiresSettingsController", () => {
    afterEach(() => {
        SettingsStore.reset();
    });

    it("forces a value if a setting is false", async () => {
        const forcedValue = true;
        await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
        await SettingsStore.setValue("useCustomFontSize", null, SettingLevel.DEVICE, false);
        const controller = new RequiresSettingsController(["useCompactLayout", "useCustomFontSize"], forcedValue);
        expect(controller.settingDisabled).toEqual(true);
        expect(controller.getValueOverride()).toEqual(forcedValue);
    });

    it("does not force a value if all settings are true", async () => {
        const controller = new RequiresSettingsController(["useCompactLayout", "useCustomFontSize"]);
        await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
        await SettingsStore.setValue("useCustomFontSize", null, SettingLevel.DEVICE, true);
        expect(controller.settingDisabled).toEqual(false);
        expect(controller.getValueOverride()).toEqual(null);
    });

    describe("with capabilites", () => {
        let client: ReturnType<typeof getMockClientWithEventEmitter>;
        beforeEach(() => {
            client = getMockClientWithEventEmitter({
                ...mockClientMethodsServer(),
                getCachedCapabilities: jest.fn().mockImplementation(() => {}),
                getCapabilities: jest.fn().mockRejectedValue({}),
            });
            MatrixClientBackedController["_matrixClient"] = client;
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("will disable setting if capability check is true", async () => {
            const caps = {
                "m.change_password": {
                    enabled: false,
                },
            };
            client.getCachedCapabilities.mockImplementation(() => caps);
            const controller = new RequiresSettingsController([], false, (c: Capabilities) => {
                expect(c).toEqual(caps);
                return !c["m.change_password"]?.enabled;
            });

            // Test that we fetch caps
            controller["initMatrixClient"]();
            expect(client.getCapabilities).toHaveBeenCalled();

            // Test that we check caps.
            expect(controller.settingDisabled).toEqual(true);
            expect(controller.getValueOverride()).toEqual(false);
            expect(client.getCachedCapabilities).toHaveBeenCalled();
        });

        it("will not disable setting if capability check is false", async () => {
            const caps = {
                "m.change_password": {
                    enabled: true,
                },
            };
            client.getCachedCapabilities.mockImplementation(() => caps);
            const controller = new RequiresSettingsController([], false, (c: Capabilities) => {
                expect(c).toEqual(caps);
                return !c["m.change_password"]?.enabled;
            });

            // Test that we fetch caps
            controller["initMatrixClient"]();
            expect(client.getCapabilities).toHaveBeenCalled();

            // Test that we check caps.
            expect(controller.settingDisabled).toEqual(false);
            expect(controller.getValueOverride()).toEqual(null);
            expect(client.getCachedCapabilities).toHaveBeenCalled();
        });

        it("will check dependency settings before checking capabilites", async () => {
            const caps = {
                "m.change_password": {
                    enabled: false,
                },
            };
            client.getCachedCapabilities.mockImplementation(() => caps);
            await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, false);
            const controller = new RequiresSettingsController(["useCompactLayout"], false, (c: Capabilities) => false);

            // Test that we fetch caps
            controller["initMatrixClient"]();
            expect(client.getCapabilities).toHaveBeenCalled();

            // Test that we check caps.
            expect(controller.settingDisabled).toEqual(true);
            expect(controller.getValueOverride()).toEqual(false);
            expect(client.getCachedCapabilities).not.toHaveBeenCalled();
        });

        it("will disable setting if capability check is true and dependency settings are true", async () => {
            const caps = {
                "m.change_password": {
                    enabled: false,
                },
            };
            client.getCachedCapabilities.mockImplementation(() => caps);
            await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
            const controller = new RequiresSettingsController(["useCompactLayout"], false, (c: Capabilities) => {
                expect(c).toEqual(caps);
                return !c["m.change_password"]?.enabled;
            });

            // Test that we fetch caps
            controller["initMatrixClient"]();
            expect(client.getCapabilities).toHaveBeenCalled();

            // Test that we check caps.
            expect(controller.settingDisabled).toEqual(true);
            expect(controller.getValueOverride()).toEqual(false);
            expect(client.getCachedCapabilities).toHaveBeenCalled();
        });
    });
});
