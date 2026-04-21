/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import RequiresSettingsController from "../../../../src/settings/controllers/RequiresSettingsController";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import SettingsStore from "../../../../src/settings/SettingsStore";

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
});
