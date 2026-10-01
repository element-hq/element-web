/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsStore from "./settings/SettingsStore";
import { FontWatcher } from "./settings/watchers/FontWatcher";
import { enumerateThemes, getOrderedThemes, setTheme } from "./theme";

describe("theme", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("setTheme", () => {
        let lightTheme: HTMLStyleElement;
        let darkTheme: HTMLStyleElement;
        let lightCustomTheme: HTMLStyleElement;

        let spyQuerySelectorAll: ReturnType<typeof vi.spyOn>;
        let spyClassList: ReturnType<typeof vi.spyOn>;

        beforeAll(() => {
            const meta = document.createElement("meta");
            meta.name = "theme-color";
            document.head.appendChild(meta);
        });

        beforeEach(() => {
            const styles = ["light", "dark", "light-custom", "dark-custom"].map(
                (theme) =>
                    ({
                        dataset: {
                            mxTheme: theme,
                        },
                        disabled: true,
                        href: "fake URL",
                        onload: (): void => void 0,
                    }) as unknown as HTMLStyleElement,
            );
            lightTheme = styles[0];
            darkTheme = styles[1];
            lightCustomTheme = styles[2];

            vi.spyOn(document.body, "style", "get").mockReturnValue([] as any);
            spyQuerySelectorAll = vi.spyOn(document, "querySelectorAll").mockReturnValue(styles as any);
            spyClassList = vi.spyOn(document.body.classList, "add");
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should switch theme on onload call", async () => {
            // When
            await new Promise((resolve) => {
                setTheme("light").then(resolve);
                lightTheme.onload!({} as Event);
            });

            // Then
            expect(spyQuerySelectorAll).toHaveBeenCalledWith("[data-mx-theme]");
            expect(lightTheme.disabled).toBe(false);
            expect(darkTheme.disabled).toBe(true);
            expect(spyClassList).toHaveBeenCalledWith("cpd-theme-light");
        });

        it("should switch to dark", async () => {
            // When
            await new Promise((resolve) => {
                setTheme("dark").then(resolve);
                darkTheme.onload!({} as Event);
            });

            // Then
            expect(spyClassList).toHaveBeenCalledWith("cpd-theme-dark");
        });

        it("should reject promise on onerror call", () => {
            return expect(
                new Promise((resolve) => {
                    setTheme("light").catch((e) => resolve(e));
                    lightTheme.onerror!("call onerror");
                }),
            ).resolves.toBe("call onerror");
        });

        it("should switch theme if CSS are preloaded", async () => {
            // When
            vi.spyOn(document, "styleSheets", "get").mockReturnValue([lightTheme] as any);

            await setTheme("light");

            // Then
            expect(lightTheme.disabled).toBe(false);
            expect(darkTheme.disabled).toBe(true);
        });

        it("should switch theme if CSS is loaded during pooling", async () => {
            // When
            vi.useFakeTimers();
            await new Promise((resolve) => {
                setTheme("light").then(resolve);
                vi.spyOn(document, "styleSheets", "get").mockReturnValue([lightTheme] as any);
                vi.advanceTimersByTime(200);
            });

            // Then
            expect(lightTheme.disabled).toBe(false);
            expect(darkTheme.disabled).toBe(true);
        });

        it("should reject promise if polling maximum value is reached", async () => {
            vi.useFakeTimers();
            const prom = setTheme("light");
            vi.advanceTimersByTime(200 * 10);
            await expect(prom).rejects.toBeUndefined();
        });

        it("applies a custom Compound theme", async () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue([
                {
                    name: "blue",
                    compound: {
                        "--cpd-color-icon-accent-tertiary": "var(--cpd-color-blue-800)",
                        "--cpd-color-text-action-accent": "var(--cpd-color-blue-900)",
                    },
                },
            ]);

            const spy = vi.spyOn(document.head, "appendChild").mockImplementation(() => undefined as any);
            await new Promise((resolve) => {
                setTheme("custom-blue").then(resolve);
                lightCustomTheme.onload!({} as Event);
            });
            expect(spy).toHaveBeenCalled();
            expect(spy.mock.calls[0][0].textContent).toMatchSnapshot();
            spy.mockRestore();
        });

        it("should handle 4-char rgba hex strings", async () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue([
                {
                    name: "blue",
                    colors: {
                        "sidebar-color": "#abcd",
                    },
                },
            ]);

            const spy = vi.fn();
            vi.spyOn(document.body, "style", "get").mockReturnValue({
                setProperty: spy,
            } as any);
            await new Promise((resolve) => {
                setTheme("custom-blue").then(resolve);
                lightCustomTheme.onload!({} as Event);
            });
            expect(spy).toHaveBeenCalledWith("--sidebar-color", "#abcd");
            expect(spy).toHaveBeenCalledWith("--sidebar-color-0pct", "#aabbcc00");
            expect(spy).toHaveBeenCalledWith("--sidebar-color-15pct", "#aabbcc21");
            expect(spy).toHaveBeenCalledWith("--sidebar-color-50pct", "#aabbcc6f");
        });

        it("should handle 6-char rgb hex strings", async () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue([
                {
                    name: "blue",
                    colors: {
                        "sidebar-color": "#abcdef",
                    },
                },
            ]);

            const spy = vi.fn();
            vi.spyOn(document.body, "style", "get").mockReturnValue({
                setProperty: spy,
            } as any);
            await new Promise((resolve) => {
                setTheme("custom-blue").then(resolve);
                lightCustomTheme.onload!({} as Event);
            });
            expect(spy).toHaveBeenCalledWith("--sidebar-color", "#abcdef");
            expect(spy).toHaveBeenCalledWith("--sidebar-color-0pct", "#abcdef00");
            expect(spy).toHaveBeenCalledWith("--sidebar-color-15pct", "#abcdef26");
            expect(spy).toHaveBeenCalledWith("--sidebar-color-50pct", "#abcdef80");
        });
    });

    describe("enumerateThemes", () => {
        it("should return a list of themes", () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue([{ name: "pink" }]);
            expect(enumerateThemes()).toEqual({
                "light": "Light",
                "light-high-contrast": "Light high contrast",
                "dark": "Dark",
                "custom-pink": "pink",
            });
        });

        it("should be robust to malformed custom_themes values", () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue([23] as any);
            expect(enumerateThemes()).toEqual({
                "light": "Light",
                "light-high-contrast": "Light high contrast",
                "dark": "Dark",
            });
        });
    });

    describe("getOrderedThemes", () => {
        it("should return a list of themes in the correct order", () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue([{ name: "Zebra Striped" }, { name: "Apple Green" }]);
            expect(getOrderedThemes()).toEqual([
                { id: "light", name: "Light" },
                { id: "dark", name: "Dark" },
                { id: "custom-Apple Green", name: "Apple Green" },
                { id: "custom-Zebra Striped", name: "Zebra Striped" },
            ]);
        });
    });

    describe("clearCustomTheme", () => {
        beforeEach(() => {
            // Reset document state
            document.body.style.cssText = "";
            document.head.querySelectorAll("style[title^='custom-theme-']").forEach((el) => el.remove());
        });

        it("should not remove font family custom properties", async () => {
            // Mock theme elements
            const lightTheme = {
                dataset: { mxTheme: "light" },
                disabled: true,
                href: "fake URL",
                onload: (): void => void 0,
            } as unknown as HTMLStyleElement;

            const removePropertySpy = vi.fn();
            const styleObject = {
                0: FontWatcher.FONT_FAMILY_CUSTOM_PROPERTY,
                1: FontWatcher.EMOJI_FONT_FAMILY_CUSTOM_PROPERTY,
                2: "--custom-color",
                length: 3,
                removeProperty: removePropertySpy,
            };
            vi.spyOn(document.body, "style", "get").mockReturnValue(styleObject as any);
            vi.spyOn(document, "querySelectorAll").mockReturnValue([lightTheme] as any);

            // Trigger clearCustomTheme via setTheme
            await new Promise((resolve) => {
                setTheme("light").then(resolve);
                lightTheme.onload!({} as Event);
            });

            // Check that font properties were NOT removed
            expect(removePropertySpy).not.toHaveBeenCalledWith(FontWatcher.FONT_FAMILY_CUSTOM_PROPERTY);
            expect(removePropertySpy).not.toHaveBeenCalledWith(FontWatcher.EMOJI_FONT_FAMILY_CUSTOM_PROPERTY);
            // But custom color should be removed
            expect(removePropertySpy).toHaveBeenCalledWith("--custom-color");
        });
    });
});
