/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { vi, describe, it, expect, beforeEach, afterEach, type MockedObject } from "vitest";
import fetchMock from "@fetch-mock/vitest";
import { logger } from "matrix-js-sdk/src/logger";
import { CustomThemeError } from "@element-hq/web-shared-components";

import { SettingLevel } from "../../settings/SettingLevel";
import { MatrixDispatcher } from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { type CustomTheme } from "../../theme";
import { CustomThemesViewModel, type CustomThemesSettingsStore } from "./CustomThemesViewModel";

const BOB_URL = "https://themes.example.org/bob.json";
/** A theme stored before we started recording source URLs, so it cannot be refreshed. */
const ALICE_THEME: CustomTheme = { name: "Alice theme", is_dark: true, colors: {} };
/** The theme as served by {@link BOB_URL}, i.e. before we stamp the source URL onto it. */
const BOB_THEME: CustomTheme = { name: "Bob theme", is_dark: false, colors: {} };
/** The theme as stored once added, with the URL it was downloaded from recorded. */
const STORED_BOB_THEME: CustomTheme = { ...BOB_THEME, source_url: BOB_URL };

describe("CustomThemesViewModel", () => {
    /** The value `custom_themes` currently resolves to. */
    let customThemes: CustomTheme[] | undefined;
    /** The value `theme` currently resolves to. */
    let currentTheme: string;
    /** The callback the view model registered with `watchSetting`. */
    let watchCallback: () => void;
    let settingsStore: MockedObject<CustomThemesSettingsStore>;
    let dispatcher: MatrixDispatcher;

    /** Build a view model wired up to the fake settings store and dispatcher. */
    function mkViewModel(): CustomThemesViewModel {
        return new CustomThemesViewModel({ settingsStore, dispatcher });
    }

    beforeEach(() => {
        customThemes = [ALICE_THEME];
        currentTheme = "light";

        dispatcher = new MatrixDispatcher();
        vi.spyOn(dispatcher, "dispatch");

        settingsStore = {
            getValue: vi.fn((key: string): any => {
                if (key === "custom_themes") return customThemes;
                if (key === "theme") return currentTheme;
            }),
            setValue: vi.fn().mockResolvedValue(undefined),
            watchSetting: vi.fn((_key: string, _roomId: string | null, cb: () => void): any => {
                watchCallback = cb;
                return "watcher-ref";
            }),
            unwatchSetting: vi.fn(),
        } as unknown as MockedObject<CustomThemesSettingsStore>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("initial snapshot", () => {
        it("lists the installed themes, marking only those with a source url as refreshable", () => {
            customThemes = [ALICE_THEME, STORED_BOB_THEME];
            const vm = mkViewModel();

            expect(vm.getSnapshot()).toEqual({
                themes: [
                    { name: "Alice theme", canRefresh: false, isRefreshing: false, error: null },
                    { name: "Bob theme", canRefresh: true, isRefreshing: false, error: null },
                ],
                url: "",
                isDownloading: false,
                error: null,
            });
        });

        it.each([undefined, null])("degrades to an empty list when the setting is %s", (value) => {
            customThemes = value as undefined;
            const vm = mkViewModel();

            expect(vm.getSnapshot().themes).toEqual([]);
        });
    });

    describe("setUrl", () => {
        it("updates the url and clears any existing error", async () => {
            const vm = mkViewModel();
            fetchMock.getOnce(BOB_URL, { body: {} });

            vm.setUrl(BOB_URL);
            await vm.addTheme();
            expect(vm.getSnapshot().error).toBe(CustomThemeError.InvalidSchema);

            vm.setUrl("https://themes.example.org/other.json");

            expect(vm.getSnapshot().url).toBe("https://themes.example.org/other.json");
            expect(vm.getSnapshot().error).toBeNull();
        });
    });

    describe("addTheme", () => {
        it.each(["", "   "])("does nothing when the url is %j", async (url) => {
            const vm = mkViewModel();
            vm.setUrl(url);

            await vm.addTheme();

            expect(fetchMock.callHistory.calls()).toHaveLength(0);
            expect(settingsStore.setValue).not.toHaveBeenCalled();
        });

        it("downloads the theme and appends it to the setting", async () => {
            fetchMock.getOnce(BOB_URL, { body: BOB_THEME });
            const vm = mkViewModel();
            vm.setUrl(BOB_URL);

            await vm.addTheme();

            expect(settingsStore.setValue).toHaveBeenCalledWith("custom_themes", null, SettingLevel.ACCOUNT, [
                ALICE_THEME,
                STORED_BOB_THEME,
            ]);
            expect(vm.getSnapshot().url).toBe("");
            expect(vm.getSnapshot().error).toBeNull();
        });

        it("does not mutate the array held by the settings store", async () => {
            fetchMock.getOnce(BOB_URL, { body: BOB_THEME });
            const stored = customThemes!;
            const vm = mkViewModel();
            vm.setUrl(BOB_URL);

            await vm.addTheme();

            const saved = settingsStore.setValue.mock.calls[0][3];
            expect(saved).not.toBe(stored);
            expect(stored).toHaveLength(1);
        });

        it("toggles isDownloading around the request and notifies subscribers", async () => {
            const { promise, resolve } = Promise.withResolvers<object>();
            fetchMock.getOnce(BOB_URL, promise);
            const vm = mkViewModel();
            const listener = vi.fn();
            vm.subscribe(listener);
            vm.setUrl(BOB_URL);

            const pending = vm.addTheme();
            expect(vm.getSnapshot().isDownloading).toBe(true);

            resolve({ body: BOB_THEME });
            await pending;

            expect(vm.getSnapshot().isDownloading).toBe(false);
            expect(listener).toHaveBeenCalled();
        });

        it("only downloads once when submitted twice in a row", async () => {
            fetchMock.get(BOB_URL, { body: BOB_THEME });
            const vm = mkViewModel();
            vm.setUrl(BOB_URL);

            await Promise.all([vm.addTheme(), vm.addTheme()]);

            expect(fetchMock.callHistory.calls(BOB_URL)).toHaveLength(1);
        });

        it.each([
            ["null", null],
            ["an empty object", {}],
            ["a non-string name", { name: 1, colors: {} }],
            ["a non-object colors", { name: "Bob theme", colors: "nope" }],
        ])("reports InvalidSchema for %s", async (_label, body) => {
            // Send the body as raw JSON text so that `null` reaches the schema check rather than
            // being sent as an empty body, which would fail to parse instead.
            fetchMock.getOnce(BOB_URL, {
                body: JSON.stringify(body),
                headers: { "Content-Type": "application/json" },
            });
            const vm = mkViewModel();
            vm.setUrl(BOB_URL);

            await vm.addTheme();

            expect(vm.getSnapshot().error).toBe(CustomThemeError.InvalidSchema);
            expect(settingsStore.setValue).not.toHaveBeenCalled();
            // The url is kept so that the user can correct it
            expect(vm.getSnapshot().url).toBe(BOB_URL);
        });

        it("reports DownloadFailed when the request throws", async () => {
            const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
            fetchMock.getOnce(BOB_URL, { throws: new Error("boom") });
            const vm = mkViewModel();
            vm.setUrl(BOB_URL);

            await vm.addTheme();

            expect(vm.getSnapshot().error).toBe(CustomThemeError.DownloadFailed);
            expect(settingsStore.setValue).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalled();
        });

        it("reports DownloadFailed on a non-ok response", async () => {
            vi.spyOn(logger, "error").mockImplementation(() => {});
            fetchMock.getOnce(BOB_URL, 404);
            const vm = mkViewModel();
            vm.setUrl(BOB_URL);

            await vm.addTheme();

            expect(vm.getSnapshot().error).toBe(CustomThemeError.DownloadFailed);
            expect(settingsStore.setValue).not.toHaveBeenCalled();
        });

        it("reports AlreadyInstalled when a theme of the same name exists", async () => {
            fetchMock.getOnce(BOB_URL, { body: ALICE_THEME });
            const vm = mkViewModel();
            vm.setUrl(BOB_URL);

            await vm.addTheme();

            expect(vm.getSnapshot().error).toBe(CustomThemeError.AlreadyInstalled);
            expect(settingsStore.setValue).not.toHaveBeenCalled();
        });
    });

    describe("refreshTheme", () => {
        /** The same theme, re-served with a different colour. */
        const UPDATED_BOB = { ...BOB_THEME, colors: { "accent-color": "#ff0000" } };

        beforeEach(() => {
            customThemes = [ALICE_THEME, STORED_BOB_THEME];
        });

        it("re-downloads the theme and replaces it in place", async () => {
            fetchMock.getOnce(BOB_URL, { body: UPDATED_BOB });
            const vm = mkViewModel();

            await vm.refreshTheme("Bob theme");

            expect(settingsStore.setValue).toHaveBeenCalledWith("custom_themes", null, SettingLevel.ACCOUNT, [
                ALICE_THEME,
                { ...UPDATED_BOB, source_url: BOB_URL },
            ]);
        });

        it("does nothing for a theme with no recorded source url", async () => {
            const vm = mkViewModel();

            await vm.refreshTheme("Alice theme");

            expect(fetchMock.callHistory.calls()).toHaveLength(0);
            expect(settingsStore.setValue).not.toHaveBeenCalled();
        });

        it("marks the theme as refreshing while in flight", async () => {
            const { promise, resolve } = Promise.withResolvers<object>();
            fetchMock.getOnce(BOB_URL, promise);
            const vm = mkViewModel();

            const pending = vm.refreshTheme("Bob theme");
            expect(vm.getSnapshot().themes[1].isRefreshing).toBe(true);

            resolve({ body: UPDATED_BOB });
            await pending;

            expect(vm.getSnapshot().themes[1].isRefreshing).toBe(false);
        });

        it("only refreshes once when clicked twice in a row", async () => {
            fetchMock.get(BOB_URL, { body: UPDATED_BOB });
            const vm = mkViewModel();

            await Promise.all([vm.refreshTheme("Bob theme"), vm.refreshTheme("Bob theme")]);

            expect(fetchMock.callHistory.calls(BOB_URL)).toHaveLength(1);
        });

        it("reports the failure against the theme and leaves it installed", async () => {
            vi.spyOn(logger, "error").mockImplementation(() => {});
            fetchMock.getOnce(BOB_URL, 500);
            const vm = mkViewModel();

            await vm.refreshTheme("Bob theme");

            expect(vm.getSnapshot().themes[1].error).toBe(CustomThemeError.DownloadFailed);
            expect(vm.getSnapshot().themes[1].isRefreshing).toBe(false);
            expect(settingsStore.setValue).not.toHaveBeenCalled();
        });

        it("clears a previous failure on a successful retry", async () => {
            vi.spyOn(logger, "error").mockImplementation(() => {});
            fetchMock.getOnce(BOB_URL, 500);
            const vm = mkViewModel();
            await vm.refreshTheme("Bob theme");
            expect(vm.getSnapshot().themes[1].error).toBe(CustomThemeError.DownloadFailed);

            fetchMock.getOnce(BOB_URL, { body: UPDATED_BOB });
            await vm.refreshTheme("Bob theme");

            expect(vm.getSnapshot().themes[1].error).toBeNull();
        });

        it("re-applies the theme when it is the active one", async () => {
            currentTheme = "custom-Bob theme";
            fetchMock.getOnce(BOB_URL, { body: UPDATED_BOB });
            const vm = mkViewModel();

            await vm.refreshTheme("Bob theme");

            expect(dispatcher.dispatch).toHaveBeenCalledWith({ action: Action.RecheckTheme });
        });

        it("does not re-apply the theme when a different one is active", async () => {
            fetchMock.getOnce(BOB_URL, { body: UPDATED_BOB });
            const vm = mkViewModel();

            await vm.refreshTheme("Bob theme");

            expect(dispatcher.dispatch).not.toHaveBeenCalled();
        });
    });

    describe("removeTheme", () => {
        it("removes the theme without touching the active theme", async () => {
            customThemes = [ALICE_THEME, BOB_THEME];
            const vm = mkViewModel();

            await vm.removeTheme("Bob theme");

            expect(settingsStore.setValue).toHaveBeenCalledOnce();
            expect(settingsStore.setValue).toHaveBeenCalledWith("custom_themes", null, SettingLevel.ACCOUNT, [
                ALICE_THEME,
            ]);
            expect(dispatcher.dispatch).not.toHaveBeenCalled();
        });

        it("resets the theme and rechecks when the removed theme was active", async () => {
            currentTheme = "custom-Alice theme";
            const vm = mkViewModel();

            await vm.removeTheme("Alice theme");

            expect(settingsStore.setValue).toHaveBeenCalledWith("custom_themes", null, SettingLevel.ACCOUNT, []);
            expect(settingsStore.setValue).toHaveBeenCalledWith("theme", null, SettingLevel.DEVICE, null);
            expect(dispatcher.dispatch).toHaveBeenCalledWith({ action: Action.RecheckTheme });
        });

        it("reads the active theme before writing custom_themes", async () => {
            // ThemeController rewrites `theme` to the default as soon as the custom theme stops
            // existing, so reading it after the write would always miss.
            currentTheme = "custom-Alice theme";
            const order: string[] = [];
            settingsStore.getValue.mockImplementation((key): any => {
                if (key === "theme") {
                    order.push("getValue:theme");
                    return currentTheme;
                }
                return customThemes;
            });
            settingsStore.setValue.mockImplementation(async (key): Promise<void> => {
                order.push(`setValue:${key}`);
            });
            const vm = mkViewModel();

            await vm.removeTheme("Alice theme");

            expect(order.indexOf("getValue:theme")).toBeLessThan(order.indexOf("setValue:custom_themes"));
        });
    });

    describe("watching the setting", () => {
        it("updates the snapshot when custom_themes changes elsewhere", () => {
            const vm = mkViewModel();
            const listener = vi.fn();
            vm.subscribe(listener);

            customThemes = [ALICE_THEME, BOB_THEME];
            watchCallback();

            expect(vm.getSnapshot().themes.map((theme) => theme.name)).toEqual(["Alice theme", "Bob theme"]);
            expect(listener).toHaveBeenCalled();
        });

        it("unwatches the setting when disposed", () => {
            const vm = mkViewModel();

            vm.dispose();

            expect(settingsStore.unwatchSetting).toHaveBeenCalledWith("watcher-ref");
        });
    });
});
