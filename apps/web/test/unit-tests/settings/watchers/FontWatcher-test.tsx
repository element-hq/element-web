/*
Copyright 2024 New Vector Ltd.
Copyright 2022 r00ster91 <r00ster91@proton.me>
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { sleep } from "matrix-js-sdk/src/utils";
import { waitFor } from "jest-matrix-react";

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

    it("should update root font size with positive delta", async () => {
        await new FontWatcher().start();

        defaultDispatcher.dispatch({
            action: Action.UpdateFontSizeDelta,
            delta: 2,
        });

        await waitFor(() => {
            const rootFontSize = document.querySelector<HTMLElement>(":root")!.style.fontSize;
            expect(rootFontSize).toContain("2px");
        });
    });
});
