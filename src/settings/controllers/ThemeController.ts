/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import { DEFAULT_THEME, enumerateThemes } from "../../theme";
import { type SettingLevel } from "../SettingLevel";

export default class ThemeController extends SettingController {
    public static isLogin = false;

    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        if (!calculatedValue) return null; // Don't override null themes

        if (ThemeController.isLogin) return "light";

        const themes = enumerateThemes();
        // Override in case some no longer supported theme is stored here
        if (!themes[calculatedValue]) {
            return DEFAULT_THEME;
        }

        return null; // no override
    }
}
