/*
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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

import {
    CATEGORIES,
    CategoryName,
    getKeyboardShortcuts,
    registerShortcut,
} from "../../src/accessibility/KeyboardShortcuts";
import { Key } from "../../src/Keyboard";
import { ISetting } from "../../src/settings/Settings";

describe("KeyboardShortcuts", () => {
    describe("registerShortcut()", () => {
        it("correctly registers shortcut", () => {
            const shortcutName = "Keybinding.definitelyARealShortcut";
            const shortcutCategory = CategoryName.NAVIGATION;
            const shortcut: ISetting = {
                displayName: "A real shortcut",
                default: {
                    ctrlKey: true,
                    key: Key.A,
                },
            };

            registerShortcut(shortcutName, shortcutCategory, shortcut);

            expect(getKeyboardShortcuts()[shortcutName]).toBe(shortcut);
            expect(CATEGORIES[shortcutCategory].settingNames.includes(shortcutName)).toBeTruthy();
        });
    });
});
