/*
Copyright 2022 r00ster91 <r00ster91@proton.me>
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

import { sleep } from "matrix-js-sdk/src/utils";

import SettingsStore from "../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { FontWatcher } from "../../../src/settings/watchers/FontWatcher";
import { Action } from "../../../src/dispatcher/actions";
import { untilDispatch } from "../../test-utils";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";

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
        expect(getFontFamily()).toBe("");
        await watcher.start();
        expect(getFontFamily()).toBe('"Font Name"');
    });

    it("should load font on Action.OnLoggedIn", async () => {
        await setSystemFont("Font Name");
        await new FontWatcher().start();
        document.body.style.removeProperty(FontWatcher.FONT_FAMILY_CUSTOM_PROPERTY); // clear the fontFamily which was  by start which we tested already
        defaultDispatcher.fire(Action.OnLoggedIn, true);
        expect(getFontFamily()).toBe('"Font Name"');
    });

    it("should reset font on Action.OnLoggedOut", async () => {
        await setSystemFont("Font Name");
        const watcher = new FontWatcher();
        await watcher.start();
        expect(getFontFamily()).toBe('"Font Name"');
        defaultDispatcher.fire(Action.OnLoggedOut, true);
        expect(getFontFamily()).toBe("");
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
            expect(getFontFamily()).toBe(`"Fira Sans Thin","Commodore 64"`);
        });
        it("does not add double quotes if already present and sets the font as the system font", async () => {
            await setSystemFont(`"Commodore 64"`);
            expect(getFontFamily()).toBe(`"Commodore 64"`);
        });
        it("trims whitespace, encloses the fonts by double quotes, and sets them as the system font", async () => {
            await setSystemFont(`  Fira Code  ,  "Commodore 64" `);
            expect(getFontFamily()).toBe(`"Fira Code","Commodore 64"`);
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

        it("by default does not add Twemoji font", async () => {
            expect(getEmojiFontFamily()).toMatchInlineSnapshot(`""`);
        });
        it("adds Twemoji font when enabled", async () => {
            await setUseBundledEmojiFont(true);
            expect(getEmojiFontFamily()).toMatchInlineSnapshot(`"Twemoji"`);
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
            watcher = new FontWatcher();
        });

        afterEach(() => {
            watcher!.stop();
        });

        it("should not run the migration", async () => {
            await watcher!.start();
            expect(SettingsStore.getValue("baseFontSizeV2")).toBe(16);
        });

        it("should migrate to default font size", async () => {
            await SettingsStore.setValue("baseFontSize", null, SettingLevel.DEVICE, 13);
            await watcher!.start();
            expect(SettingsStore.getValue("baseFontSizeV2")).toBe(19);
        });
    });
});
