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

import { setTheme } from "../src/theme";

describe("theme", () => {
    describe("setTheme", () => {
        let lightTheme: HTMLStyleElement;
        let darkTheme: HTMLStyleElement;

        let spyQuerySelectorAll: jest.MockInstance<NodeListOf<Element>, [selectors: string]>;

        beforeEach(() => {
            const styles = [
                {
                    dataset: {
                        mxTheme: "light",
                    },
                    disabled: true,
                    href: "urlLight",
                    onload: (): void => void 0,
                } as unknown as HTMLStyleElement,
                {
                    dataset: {
                        mxTheme: "dark",
                    },
                    disabled: true,
                    href: "urlDark",
                    onload: (): void => void 0,
                } as unknown as HTMLStyleElement,
            ];
            lightTheme = styles[0];
            darkTheme = styles[1];

            jest.spyOn(document.body, "style", "get").mockReturnValue([] as any);
            spyQuerySelectorAll = jest.spyOn(document, "querySelectorAll").mockReturnValue(styles as any);
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
    });
});
