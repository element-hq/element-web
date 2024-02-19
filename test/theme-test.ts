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

import SettingsStore from "../src/settings/SettingsStore";
import { enumerateThemes, setTheme } from "../src/theme";

describe("theme", () => {
    describe("setTheme", () => {
        let lightTheme: HTMLStyleElement;
        let darkTheme: HTMLStyleElement;
        let lightCustomTheme: HTMLStyleElement;

        let spyQuerySelectorAll: jest.MockInstance<NodeListOf<Element>, [selectors: string]>;
        let spyClassList: jest.SpyInstance<void, string[], any>;

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

            jest.spyOn(document.body, "style", "get").mockReturnValue([] as any);
            spyQuerySelectorAll = jest.spyOn(document, "querySelectorAll").mockReturnValue(styles as any);
            spyClassList = jest.spyOn(document.body.classList, "add");
        });

        afterEach(() => {
            jest.restoreAllMocks();
            jest.useRealTimers();
        });

        it("should switch theme on onload call", async () => {
            // When
            await new Promise((resolve) => {
                setTheme("light").then(resolve);
                lightTheme.onload!({} as Event);
            });

            // Then
            expect(spyQuerySelectorAll).toHaveBeenCalledWith("[data-mx-theme]");
            expect(spyQuerySelectorAll).toHaveBeenCalledTimes(1);
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
            jest.spyOn(document, "styleSheets", "get").mockReturnValue([lightTheme] as any);

            await setTheme("light");

            // Then
            expect(lightTheme.disabled).toBe(false);
            expect(darkTheme.disabled).toBe(true);
        });

        it("should switch theme if CSS is loaded during pooling", async () => {
            // When
            jest.useFakeTimers();
            await new Promise((resolve) => {
                setTheme("light").then(resolve);
                jest.spyOn(document, "styleSheets", "get").mockReturnValue([lightTheme] as any);
                jest.advanceTimersByTime(200);
            });

            // Then
            expect(lightTheme.disabled).toBe(false);
            expect(darkTheme.disabled).toBe(true);
        });

        it("should reject promise if pooling maximum value is reached", () => {
            jest.useFakeTimers();
            return new Promise((resolve) => {
                setTheme("light").catch(resolve);
                jest.advanceTimersByTime(200 * 10);
            });
        });

        it("applies a custom Compound theme", async () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue([
                {
                    name: "blue",
                    compound: {
                        "--cpd-color-icon-accent-tertiary": "var(--cpd-color-blue-800)",
                        "--cpd-color-text-action-accent": "var(--cpd-color-blue-900)",
                    },
                },
            ]);

            const spy = jest.spyOn(document.head, "appendChild").mockImplementation();
            await new Promise((resolve) => {
                setTheme("custom-blue").then(resolve);
                lightCustomTheme.onload!({} as Event);
            });
            expect(spy).toHaveBeenCalled();
            expect(spy.mock.calls[0][0].textContent).toMatchSnapshot();
            spy.mockRestore();
        });
    });

    describe("enumerateThemes", () => {
        it("should return a list of themes", () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue([{ name: "pink" }]);
            expect(enumerateThemes()).toEqual({
                "light": "Light",
                "light-high-contrast": "Light high contrast",
                "dark": "Dark",
                "custom-pink": "pink",
            });
        });

        it("should be robust to malformed custom_themes values", () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue([23]);
            expect(enumerateThemes()).toEqual({
                "light": "Light",
                "light-high-contrast": "Light high contrast",
                "dark": "Dark",
            });
        });
    });
});
