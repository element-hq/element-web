/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, it, expect, beforeEach } from "vitest";

import IncompatibleController from "./IncompatibleController";
import { SettingLevel } from "../SettingLevel";
import SettingsStore from "../SettingsStore";

declare module "../Settings.tsx" {
    interface Settings {
        test_setting: IBaseSetting<string>;
    }
}

describe("IncompatibleController", () => {
    const settingsGetValueSpy = vi.spyOn(SettingsStore, "getValue");
    beforeEach(() => {
        settingsGetValueSpy.mockClear();
    });

    describe("incompatibleSetting", () => {
        describe("when incompatibleValue is not set", () => {
            it("returns true when setting value is true", () => {
                // no incompatible value set, defaulted to true
                const controller = new IncompatibleController("test_setting", { key: null });
                settingsGetValueSpy.mockReturnValue(true);
                // true === true
                expect(controller.incompatibleSetting).toBe(true);
                expect(controller.settingDisabled).toEqual(true);
                expect(settingsGetValueSpy).toHaveBeenCalledWith("test_setting");
            });

            it("returns false when setting value is not true", () => {
                // no incompatible value set, defaulted to true
                const controller = new IncompatibleController("test_setting", { key: null });
                settingsGetValueSpy.mockReturnValue("test");
                expect(controller.incompatibleSetting).toBe(false);
            });
        });

        describe("when incompatibleValue is set to a value", () => {
            it("returns true when setting value matches incompatible value", () => {
                const controller = new IncompatibleController("test_setting", { key: null }, "test");
                settingsGetValueSpy.mockReturnValue("test");
                expect(controller.incompatibleSetting).toBe(true);
            });

            it("returns false when setting value is not true", () => {
                const controller = new IncompatibleController("test_setting", { key: null }, "test");
                settingsGetValueSpy.mockReturnValue("not test");
                expect(controller.incompatibleSetting).toBe(false);
            });
        });

        describe("when incompatibleValue is set to a function", () => {
            it("returns result from incompatibleValue function", () => {
                const incompatibleValueFn = vi.fn().mockReturnValue(false);
                const controller = new IncompatibleController("test_setting", { key: null }, incompatibleValueFn);
                settingsGetValueSpy.mockReturnValue("test");
                expect(controller.incompatibleSetting).toBe(false);
                expect(incompatibleValueFn).toHaveBeenCalledWith("test");
            });
        });
    });

    describe("getValueOverride()", () => {
        it("returns forced value when setting is incompatible", () => {
            settingsGetValueSpy.mockReturnValue(true);
            const controller = new IncompatibleController("test_setting", { key: null });
            expect(
                controller.getValueOverride(SettingLevel.ACCOUNT, "$room:server", true, SettingLevel.ACCOUNT),
            ).toEqual({ key: null });
        });

        it("returns null when setting is not incompatible", () => {
            settingsGetValueSpy.mockReturnValue(false);
            const controller = new IncompatibleController("test_setting", { key: null });
            expect(
                controller.getValueOverride(SettingLevel.ACCOUNT, "$room:server", true, SettingLevel.ACCOUNT),
            ).toEqual(null);
        });
    });
});
