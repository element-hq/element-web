/*
Copyright 2022 r00ster91 <r00ster91@proton.me>

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

import { sleep } from 'matrix-js-sdk/src/utils';

import SettingsStore from '../../../src/settings/SettingsStore';
import { SettingLevel } from '../../../src/settings/SettingLevel';
import { FontWatcher } from "../../../src/settings/watchers/FontWatcher";
import { Action } from "../../../src/dispatcher/actions";
import { untilDispatch } from "../../test-utils";

async function setSystemFont(font: string): Promise<void> {
    await SettingsStore.setValue("systemFont", null, SettingLevel.DEVICE, font);
    await untilDispatch(Action.UpdateSystemFont);
    await sleep(1); // await the FontWatcher doing its action
}

describe('FontWatcher', function() {
    let fontWatcher: FontWatcher;
    beforeEach(() => {
        fontWatcher = new FontWatcher();
        fontWatcher.start();
        return SettingsStore.setValue("useSystemFont", null, SettingLevel.DEVICE, true);
    });
    afterEach(() => {
        fontWatcher.stop();
    });

    it('encloses the fonts by double quotes and sets them as the system font', async () => {
        await setSystemFont("Fira Sans Thin, Commodore 64");
        expect(document.body.style.fontFamily).toBe(`"Fira Sans Thin","Commodore 64"`);
    });
    it('does not add double quotes if already present and sets the font as the system font', async () => {
        await setSystemFont(`"Commodore 64"`);
        expect(document.body.style.fontFamily).toBe(`"Commodore 64"`);
    });
    it('trims whitespace, encloses the fonts by double quotes, and sets them as the system font', async () => {
        await setSystemFont(`  Fira Code  ,  "Commodore 64" `);
        expect(document.body.style.fontFamily).toBe(`"Fira Code","Commodore 64"`);
    });
});
