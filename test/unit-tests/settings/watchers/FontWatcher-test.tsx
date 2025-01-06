/*
Copyright 2024 New Vector Ltd.
Copyright 2022 r00ster91 <r00ster91@proton.me>
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { sleep } from "matrix-js-sdk/src/utils";

import SettingsStore from "../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { FontWatcher } from "../../../../src/settings/watchers/FontWatcher";
import { Action } from "../../../../src/dispatcher/actions";
import { untilDispatch } from "../../../test-utils";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";

async function setSystemFont(font: string | false): Promise<void> {
    await SettingsStore.setValue("systemFont", null, SettingLevel.DEVICE, font || "");
    await SettingsStore.setValue("useSystemFont", null, SettingLevel.DEVICE, !!font);
    await untilDispatch(Action.UpdateSystemFont);
    await sleep(1); // await the FontWatcher doing its action
}

async function setUseBundledEmojiFont(use: boolean): Promise<void> {
    await SettingsStore.setValue("useBundledEmojiFont", null, SettingLevel.DEVICE, use);
    await untilDispatch(Action.UpdateSystemFont);
    await sleep(1); // await the FontWatcher doing its action
}

const getFontFamily = () => {
    return document.body.style.getPropertyValue(FontWatcher.FONT_FAMILY_CUSTOM_PROPERTY);
};
const getEmojiFontFamily = () => {
    return document.body.style.getPropertyValue(FontWatcher.EMOJI_FONT_FAMILY_CUSTOM_PROPERTY);
};

describe("FontWatcher", function () {
    it("should load font on start()", async () => {
        const watcher = new FontWatcher();
        await setSystemFont("Font Name");
        expect(getFontFamily()).toMatchInlineSnapshot(`""`);
        await watcher.start();
        expect(getFontFamily()).toMatchInlineSnapshot(`""Font Name", Twemoji"`);
    });

    it("should load font on Action.OnLoggedIn", async () => {
        await setSystemFont("Font Name");
        await new FontWatcher().start();
        document.body.style.removeProperty(FontWatcher.FONT_FAMILY_CUSTOM_PROPERTY); // clear the fontFamily which was  by start which we tested already
        defaultDispatcher.fire(Action.OnLoggedIn, true);
        expect(getFontFamily()).toMatchInlineSnapshot(`""Font Name", Twemoji"`);
    });

    it("should reset font on Action.OnLoggedOut", async () => {
        await setSystemFont("Font Name");
        const watcher = new FontWatcher();
        await watcher.start();
        expect(getFontFamily()).toMatchInlineSnapshot(`""Font Name", Twemoji"`);
        defaultDispatcher.fire(Action.OnLoggedOut, true);
        expect(getFontFamily()).toMatchInlineSnapshot(`""`);
    });

    describe("Sets font as expected", () => {
        let fontWatcher: FontWatcher;
        beforeEach(async () => {
            fontWatcher = new FontWatcher();
            await fontWatcher.start();
        });
        afterEach(() => {
            fontWatcher.stop();
        });

        it("encloses the fonts by double quotes and sets them as the system font", async () => {
            await setSystemFont("Fira Sans Thin, Commodore 64");
            expect(getFontFamily()).toMatchInlineSnapshot(`""Fira Sans Thin","Commodore 64", Twemoji"`);
        });
        it("does not add double quotes if already present and sets the font as the system font", async () => {
            await setSystemFont(`"Commodore 64"`);
            expect(getFontFamily()).toMatchInlineSnapshot(`""Commodore 64", Twemoji"`);
        });
        it("trims whitespace, encloses the fonts by double quotes, and sets them as the system font", async () => {
            await setSystemFont(`  Fira Code  ,  "Commodore 64" `);
            expect(getFontFamily()).toMatchInlineSnapshot(`""Fira Code","Commodore 64", Twemoji"`);
        });
    });

    describe("Sets bundled emoji font as expected", () => {
        let fontWatcher: FontWatcher;
        beforeEach(async () => {
            await setSystemFont(false);
            fontWatcher = new FontWatcher();
            await fontWatcher.start();
        });
        afterEach(() => {
            fontWatcher.stop();
        });

        it("by default adds Twemoji font", async () => {
            expect(getEmojiFontFamily()).toMatchInlineSnapshot(`"Twemoji"`);
        });
        it("does not add Twemoji font when disabled", async () => {
            await setUseBundledEmojiFont(false);
            expect(getEmojiFontFamily()).toMatchInlineSnapshot(`""`);
        });
        it("works in conjunction with useSystemFont", async () => {
            await setSystemFont(`"Commodore 64"`);
            await setUseBundledEmojiFont(true);
            expect(getFontFamily()).toMatchInlineSnapshot(`""Commodore 64", Twemoji"`);
        });
    });

    describe("Migrates baseFontSize", () => {
        let watcher: FontWatcher | undefined;

        beforeEach(() => {
            document.documentElement.style.fontSize = "14px";
            watcher = new FontWatcher();
        });

        afterEach(() => {
            watcher!.stop();
        });

        it("should not run the migration", async () => {
            await watcher!.start();
            expect(SettingsStore.getValue("fontSizeDelta")).toBe(0);
        });

        it("should migrate from V1 font size to V3", async () => {
            await SettingsStore.setValue("baseFontSize", null, SettingLevel.DEVICE, 13);
            await watcher!.start();
            // 13px (V1 font size) + 5px (V1 offset) + 1px (root font size increase) - 14px (default browser font size) = 5px
            expect(SettingsStore.getValue("fontSizeDelta")).toBe(5);
            // baseFontSize should be cleared
            expect(SettingsStore.getValue("baseFontSize")).toBe(0);
        });

        it("should migrate from V2 font size to V3 using browser font size", async () => {
            await SettingsStore.setValue("baseFontSizeV2", null, SettingLevel.DEVICE, 18);
            await watcher!.start();
            // 18px - 14px (default browser font size) = 2px
            expect(SettingsStore.getValue("fontSizeDelta")).toBe(4);
            // baseFontSize should be cleared
            expect(SettingsStore.getValue("baseFontSizeV2")).toBe(0);
        });

        it("should migrate from V2 font size to V3 using fallback font size", async () => {
            document.documentElement.style.fontSize = "";
            await SettingsStore.setValue("baseFontSizeV2", null, SettingLevel.DEVICE, 18);
            await watcher!.start();
            // 18px - 16px (fallback) = 2px
            expect(SettingsStore.getValue("fontSizeDelta")).toBe(2);
            // baseFontSize should be cleared
            expect(SettingsStore.getValue("baseFontSizeV2")).toBe(0);
        });
    });
});
