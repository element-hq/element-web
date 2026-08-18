/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, vi } from "vitest";

import SettingsStore from "../SettingsStore";
import ThemeController from "./ThemeController";
import { SettingLevel } from "../SettingLevel";
import { DEFAULT_THEME } from "../../theme";

describe("ThemeController", () => {
    vi.spyOn(SettingsStore, "getValue").mockReturnValue([]);

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
