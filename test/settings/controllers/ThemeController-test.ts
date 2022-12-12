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

import ThemeController from "../../../src/settings/controllers/ThemeController";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import SettingsStore from "../../../src/settings/SettingsStore";
import { DEFAULT_THEME } from "../../../src/theme";

describe("ThemeController", () => {
    jest.spyOn(SettingsStore, "getValue").mockReturnValue([]);

    afterEach(() => {
        // reset
        ThemeController.isLogin = false;
    });

    it("returns null when calculatedValue is falsy", () => {
        const controller = new ThemeController();

        expect(
            controller.getValueOverride(
                SettingLevel.ACCOUNT,
                "$room:server",
                undefined /* calculatedValue */,
                SettingLevel.ACCOUNT,
            ),
        ).toEqual(null);
    });

    it("returns light when login flag is set", () => {
        const controller = new ThemeController();

        ThemeController.isLogin = true;

        expect(controller.getValueOverride(SettingLevel.ACCOUNT, "$room:server", "dark", SettingLevel.ACCOUNT)).toEqual(
            "light",
        );
    });

    it("returns default theme when value is not a valid theme", () => {
        const controller = new ThemeController();

        expect(
            controller.getValueOverride(SettingLevel.ACCOUNT, "$room:server", "my-test-theme", SettingLevel.ACCOUNT),
        ).toEqual(DEFAULT_THEME);
    });

    it("returns null when value is a valid theme", () => {
        const controller = new ThemeController();

        expect(controller.getValueOverride(SettingLevel.ACCOUNT, "$room:server", "dark", SettingLevel.ACCOUNT)).toEqual(
            null,
        );
    });
});
