/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import IncompatibleController from "../../../../src/settings/controllers/IncompatibleController";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { type FeatureSettingKey } from "../../../../src/settings/Settings.tsx";

describe("IncompatibleController", () => {
    const settingsGetValueSpy = jest.spyOn(SettingsStore, "getValue");
    beforeEach(() => {
        settingsGetValueSpy.mockClear();
    });

    describe("incompatibleSetting", () => {
        describe("when incompatibleValue is not set", () => {
            it("returns true when setting value is true", () => {
                // no incompatible value set, defaulted to true
                const controller = new IncompatibleController("feature_spotlight" as FeatureSettingKey, { key: null });
                settingsGetValueSpy.mockReturnValue(true);
                // true === true
                expect(controller.incompatibleSetting).toBe(true);
                expect(controller.settingDisabled).toEqual(true);
                expect(settingsGetValueSpy).toHaveBeenCalledWith("feature_spotlight");
            });

            it("returns false when setting value is not true", () => {
                // no incompatible value set, defaulted to true
                const controller = new IncompatibleController("feature_spotlight" as FeatureSettingKey, { key: null });
                settingsGetValueSpy.mockReturnValue("test");
                expect(controller.incompatibleSetting).toBe(false);
            });
        });

        describe("when incompatibleValue is set to a value", () => {
            it("returns true when setting value matches incompatible value", () => {
                const controller = new IncompatibleController(
                    "feature_spotlight" as FeatureSettingKey,
                    { key: null },
                    "test",
                );
                settingsGetValueSpy.mockReturnValue("test");
                expect(controller.incompatibleSetting).toBe(true);
            });

            it("returns false when setting value is not true", () => {
                const controller = new IncompatibleController(
                    "feature_spotlight" as FeatureSettingKey,
                    { key: null },
                    "test",
                );
                settingsGetValueSpy.mockReturnValue("not test");
                expect(controller.incompatibleSetting).toBe(false);
            });
        });

        describe("when incompatibleValue is set to a function", () => {
            it("returns result from incompatibleValue function", () => {
                const incompatibleValueFn = jest.fn().mockReturnValue(false);
                const controller = new IncompatibleController(
                    "feature_spotlight" as FeatureSettingKey,
                    { key: null },
                    incompatibleValueFn,
                );
                settingsGetValueSpy.mockReturnValue("test");
                expect(controller.incompatibleSetting).toBe(false);
                expect(incompatibleValueFn).toHaveBeenCalledWith("test");
            });
        });
    });

    describe("getValueOverride()", () => {
        it("returns forced value when setting is incompatible", () => {
            settingsGetValueSpy.mockReturnValue(true);
            const controller = new IncompatibleController("feature_spotlight" as FeatureSettingKey, { key: null });
            expect(
                controller.getValueOverride(SettingLevel.ACCOUNT, "$room:server", true, SettingLevel.ACCOUNT),
            ).toEqual({ key: null });
        });

        it("returns null when setting is not incompatible", () => {
            settingsGetValueSpy.mockReturnValue(false);
            const controller = new IncompatibleController("feature_spotlight" as FeatureSettingKey, { key: null });
            expect(
                controller.getValueOverride(SettingLevel.ACCOUNT, "$room:server", true, SettingLevel.ACCOUNT),
            ).toEqual(null);
        });
    });
});
