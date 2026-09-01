/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { mockPlatformPeg } from "test-utils/platform";

import QuickThemeSwitcher from "./QuickThemeSwitcher";
import { getOrderedThemes } from "../../../theme";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { useTheme } from "../../../hooks/useTheme";

vi.mock("../../../hooks/useTheme", () => ({
    useTheme: vi.fn(),
}));
vi.mock("../../../theme");
vi.mock("../../../settings/SettingsStore", () => ({
    default: {
        setValue: vi.fn(),
        getValue: vi.fn(),
        monitorSetting: vi.fn(),
        watchSetting: vi.fn(),
    },
}));

vi.mock("../../../dispatcher/dispatcher", () => ({
    default: {
        dispatch: vi.fn(),
        register: vi.fn(),
    },
}));

mockPlatformPeg({ overrideBrowserShortcuts: vi.fn().mockReturnValue(false) });

describe("<QuickThemeSwitcher />", () => {
    const defaultProps = {
        requestClose: vi.fn(),
    };
    const renderComponent = (props = {}) => render(<QuickThemeSwitcher {...defaultProps} {...props} />);

    beforeEach(() => {
        vi.mocked(getOrderedThemes)
            .mockClear()
            .mockReturnValue([
                { id: "light", name: "Light" },
                { id: "dark", name: "Dark" },
            ]);

        vi.mocked(useTheme).mockClear().mockReturnValue({
            theme: "light",
            systemThemeActivated: false,
        });
        vi.mocked(SettingsStore).setValue.mockClear().mockResolvedValue();
        vi.mocked(dis).dispatch.mockClear();
    });

    const selectFromDropdown = async (getByTextArg: RegExp | string) => {
        const dropdown = screen.getByRole("button", { name: "Theme" });
        await userEvent.click(dropdown);
        await waitFor(() => {
            expect(dropdown).toHaveAttribute("aria-expanded", "true");
        });
        await userEvent.click(screen.getByText(getByTextArg));
        return waitFor(() => {
            expect(dropdown).toHaveAttribute("aria-expanded", "false");
        });
    };

    it("renders dropdown correctly when light theme is selected", () => {
        renderComponent();
        expect(screen.getByText("Light")).toBeInTheDocument();
    });

    it("renders dropdown correctly when use system theme is truthy", () => {
        vi.mocked(useTheme).mockClear().mockReturnValue({
            theme: "light",
            systemThemeActivated: true,
        });
        renderComponent();
        expect(screen.getByText("Match system")).toBeInTheDocument();
    });

    it("updates settings when match system is selected", async () => {
        const requestClose = vi.fn();
        renderComponent({ requestClose });

        await selectFromDropdown(/match system/i);

        expect(SettingsStore.setValue).toHaveBeenCalledTimes(1);
        expect(SettingsStore.setValue).toHaveBeenCalledWith("use_system_theme", null, SettingLevel.DEVICE, true);

        expect(dis.dispatch).not.toHaveBeenCalled();
        expect(requestClose).toHaveBeenCalled();
    });

    it("updates settings when a theme is selected", async () => {
        // ie not match system
        const requestClose = vi.fn();
        renderComponent({ requestClose });

        await selectFromDropdown(/dark/i);

        expect(SettingsStore.setValue).toHaveBeenCalledWith("use_system_theme", null, SettingLevel.DEVICE, false);
        expect(SettingsStore.setValue).toHaveBeenCalledWith("theme", null, SettingLevel.DEVICE, "dark");

        expect(dis.dispatch).toHaveBeenCalledWith({ action: Action.RecheckTheme, forceTheme: "dark" });
        expect(requestClose).toHaveBeenCalled();
    });

    it("rechecks theme when setting theme fails", async () => {
        vi.mocked(SettingsStore.setValue).mockRejectedValue("oops");
        const requestClose = vi.fn();
        renderComponent({ requestClose });

        await selectFromDropdown(/match system/i);

        expect(dis.dispatch).toHaveBeenCalledWith({ action: Action.RecheckTheme });
        expect(requestClose).toHaveBeenCalled();
    });
});
