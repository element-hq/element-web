/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi, type Mocked } from "vitest";
import { render, screen, waitFor } from "test-utils-rtl";
import React, { act } from "react";

import { ThemeChoicePanel } from "./ThemeChoicePanel";
import SettingsStore from "../../../settings/SettingsStore";
import ThemeWatcher from "../../../settings/watchers/ThemeWatcher";
import { SettingLevel } from "../../../settings/SettingLevel";

vi.mock("../../../settings/watchers/ThemeWatcher");

describe("<ThemeChoicePanel />", () => {
    /**
     * Enable or disable the system theme
     * @param enable
     */
    async function enableSystemTheme(enable: boolean) {
        await SettingsStore.setValue("use_system_theme", null, SettingLevel.DEVICE, enable);
    }

    /**
     * Set the theme
     * @param theme
     */
    async function setTheme(theme: string) {
        await SettingsStore.setValue("theme", null, SettingLevel.DEVICE, theme);
    }

    beforeEach(async () => {
        vi.mocked(ThemeWatcher).mockImplementation(function () {
            return {
                isSystemThemeSupported: vi.fn().mockReturnValue(true),
            } as unknown as Mocked<ThemeWatcher>;
        });

        await enableSystemTheme(false);
        await setTheme("light");
    });

    it("renders the theme choice UI", () => {
        const { asFragment } = render(<ThemeChoicePanel />);
        expect(asFragment()).toMatchSnapshot();
    });

    describe("theme selection", () => {
        describe("system theme", () => {
            it("should disable Match system theme", async () => {
                render(<ThemeChoicePanel />);
                expect(screen.getByRole("switch", { name: "Match system theme" })).not.toBeChecked();
            });

            it("should enable Match system theme", async () => {
                await enableSystemTheme(true);

                render(<ThemeChoicePanel />);
                expect(screen.getByRole("switch", { name: "Match system theme" })).toBeChecked();
            });

            it("should change the system theme when clicked", async () => {
                vi.spyOn(SettingsStore, "setValue");

                render(<ThemeChoicePanel />);
                act(() => screen.getByRole("switch", { name: "Match system theme" }).click());

                // The system theme should be enabled
                expect(screen.getByRole("switch", { name: "Match system theme" })).toBeChecked();
                expect(SettingsStore.setValue).toHaveBeenCalledWith("use_system_theme", null, "device", true);
            });
        });

        describe("theme selection", () => {
            it("should disable theme selection when system theme is enabled", async () => {
                await enableSystemTheme(true);
                render(<ThemeChoicePanel />);

                // We expect all the themes to be disabled
                const themes = screen.getAllByRole("radio");
                themes.forEach((theme) => {
                    expect(theme).toBeDisabled();
                });
            });

            it("should enable theme selection when system theme is disabled", async () => {
                render(<ThemeChoicePanel />);

                // We expect all the themes to be disabled
                const themes = screen.getAllByRole("radio");
                themes.forEach((theme) => {
                    expect(theme).not.toBeDisabled();
                });
            });

            it("should have light theme selected", async () => {
                render(<ThemeChoicePanel />);

                // We expect the light theme to be selected
                const lightTheme = screen.getByRole("radio", { name: "Light" });
                expect(lightTheme).toBeChecked();

                // And the dark theme shouldn't be selected
                const darkTheme = screen.getByRole("radio", { name: "Dark" });
                expect(darkTheme).not.toBeChecked();
            });

            it("should switch to dark theme", async () => {
                vi.spyOn(SettingsStore, "setValue");

                render(<ThemeChoicePanel />);

                const darkTheme = screen.getByRole("radio", { name: "Dark" });
                const lightTheme = screen.getByRole("radio", { name: "Light" });
                expect(darkTheme).not.toBeChecked();

                // Switch to the dark theme
                act(() => darkTheme.click());
                expect(SettingsStore.setValue).toHaveBeenCalledWith("theme", null, "device", "dark");

                // Dark theme is now selected
                await waitFor(() => expect(darkTheme).toBeChecked());
                // Light theme is not selected anymore
                expect(lightTheme).not.toBeChecked();
                // The setting should be updated
                expect(SettingsStore.setValue).toHaveBeenCalledWith("theme", null, "device", "dark");
            });
        });
    });

    describe("custom theme", () => {
        const aliceTheme = { name: "Alice theme", is_dark: true, colors: {} };

        beforeEach(async () => {
            await SettingsStore.setValue("custom_themes", null, SettingLevel.DEVICE, [aliceTheme]);
        });

        afterEach(() => {
            SettingsStore.reset();
        });

        it("should render the custom theme section", () => {
            const { asFragment } = render(<ThemeChoicePanel />);
            expect(asFragment()).toMatchSnapshot();
        });

        it("should display custom theme", () => {
            const { asFragment } = render(<ThemeChoicePanel />);

            expect(screen.getByRole("radio", { name: aliceTheme.name })).toBeInTheDocument();
            expect(asFragment()).toMatchSnapshot();
        });
    });
});
