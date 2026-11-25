/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "test-utils-rtl";

import { useTheme } from "./useTheme";
import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";
import dis from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";

describe("useTheme", () => {
    beforeEach(async () => {
        await SettingsStore.setValue("use_system_theme", null, SettingLevel.DEVICE, false);
        await SettingsStore.setValue("theme", null, SettingLevel.DEVICE, "light");
    });

    it("returns the chosen theme as the effective theme when not matching the system", () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current).toEqual({ theme: "light", systemThemeActivated: false, effectiveTheme: "light" });
    });

    it("follows changes to the theme setting", async () => {
        const { result } = renderHook(() => useTheme());
        await act(() => SettingsStore.setValue("theme", null, SettingLevel.DEVICE, "dark"));
        await waitFor(() => expect(result.current.theme).toBe("dark"));
        expect(result.current.effectiveTheme).toBe("dark");
    });

    it("reports system theme matching without changing the chosen theme", async () => {
        const { result } = renderHook(() => useTheme());
        await act(() => SettingsStore.setValue("use_system_theme", null, SettingLevel.DEVICE, true));
        await waitFor(() => expect(result.current.systemThemeActivated).toBe(true));
        expect(result.current.theme).toBe("light");
    });

    it("follows a forced theme in the effective theme only", async () => {
        const { result } = renderHook(() => useTheme());
        act(() => dis.dispatch({ action: Action.RecheckTheme, forceTheme: "dark-high-contrast" }, true));
        await waitFor(() => expect(result.current.effectiveTheme).toBe("dark-high-contrast"));
        expect(result.current.theme).toBe("light");
    });
});
