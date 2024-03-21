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

import IncompatibleController from "../../../src/settings/controllers/IncompatibleController";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import SettingsStore from "../../../src/settings/SettingsStore";

describe("IncompatibleController", () => {
    const settingsGetValueSpy = jest.spyOn(SettingsStore, "getValue");
    beforeEach(() => {
        settingsGetValueSpy.mockClear();
    });

    describe("incompatibleSetting", () => {
        describe("when incompatibleValue is not set", () => {
            it("returns true when setting value is true", () => {
                // no incompatible value set, defaulted to true
                const controller = new IncompatibleController("feature_spotlight", { key: null });
                settingsGetValueSpy.mockReturnValue(true);
                // true === true
                expect(controller.incompatibleSetting).toBe(true);
                expect(controller.settingDisabled).toEqual(true);
                expect(settingsGetValueSpy).toHaveBeenCalledWith("feature_spotlight");
            });

            it("returns false when setting value is not true", () => {
                // no incompatible value set, defaulted to true
                const controller = new IncompatibleController("feature_spotlight", { key: null });
                settingsGetValueSpy.mockReturnValue("test");
                expect(controller.incompatibleSetting).toBe(false);
            });
        });

        describe("when incompatibleValue is set to a value", () => {
            it("returns true when setting value matches incompatible value", () => {
                const controller = new IncompatibleController("feature_spotlight", { key: null }, "test");
                settingsGetValueSpy.mockReturnValue("test");
                expect(controller.incompatibleSetting).toBe(true);
            });

            it("returns false when setting value is not true", () => {
                const controller = new IncompatibleController("feature_spotlight", { key: null }, "test");
                settingsGetValueSpy.mockReturnValue("not test");
                expect(controller.incompatibleSetting).toBe(false);
            });
        });

        describe("when incompatibleValue is set to a function", () => {
            it("returns result from incompatibleValue function", () => {
                const incompatibleValueFn = jest.fn().mockReturnValue(false);
                const controller = new IncompatibleController("feature_spotlight", { key: null }, incompatibleValueFn);
                settingsGetValueSpy.mockReturnValue("test");
                expect(controller.incompatibleSetting).toBe(false);
                expect(incompatibleValueFn).toHaveBeenCalledWith("test");
            });
        });
    });

    describe("getValueOverride()", () => {
        it("returns forced value when setting is incompatible", () => {
            settingsGetValueSpy.mockReturnValue(true);
            const controller = new IncompatibleController("feature_spotlight", { key: null });
            expect(
                controller.getValueOverride(SettingLevel.ACCOUNT, "$room:server", true, SettingLevel.ACCOUNT),
            ).toEqual({ key: null });
        });

        it("returns null when setting is not incompatible", () => {
            settingsGetValueSpy.mockReturnValue(false);
            const controller = new IncompatibleController("feature_spotlight", { key: null });
            expect(
                controller.getValueOverride(SettingLevel.ACCOUNT, "$room:server", true, SettingLevel.ACCOUNT),
            ).toEqual(null);
        });
    });
});
