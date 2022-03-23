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
    KEYBOARD_SHORTCUTS,
    mock,
} from "../../src/accessibility/KeyboardShortcuts";
import { getKeyboardShortcuts, getKeyboardShortcutsForUI } from "../../src/accessibility/KeyboardShortcutUtils";
import { mockPlatformPeg, unmockPlatformPeg } from "../test-utils";

describe("KeyboardShortcutUtils", () => {
    afterEach(() => {
        unmockPlatformPeg();
    });

    it("doesn't change KEYBOARD_SHORTCUTS when getting shortcuts", async () => {
        mock({
            keyboardShortcuts: {
                "Keybind1": {},
                "Keybind2": {},
            },
            macOnlyShortcuts: ["Keybind1"],
            desktopShortcuts: ["Keybind2"],
        });
        mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
        const copyKeyboardShortcuts = Object.assign({}, KEYBOARD_SHORTCUTS);

        getKeyboardShortcuts();
        expect(KEYBOARD_SHORTCUTS).toEqual(copyKeyboardShortcuts);
        getKeyboardShortcutsForUI();
        expect(KEYBOARD_SHORTCUTS).toEqual(copyKeyboardShortcuts);
    });

    it("correctly filters shortcuts", async () => {
        mock({
            keyboardShortcuts: {
                "Keybind1": {},
                "Keybind2": {},
                "Keybind3": { "controller": { settingDisabled: true } },
                "Keybind4": {},
            },
            macOnlyShortcuts: ["Keybind1"],
            desktopShortcuts: ["Keybind2"],

        });
        mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
        expect(getKeyboardShortcuts()).toEqual({ "Keybind4": {} });

        mock({
            keyboardShortcuts: {
                "Keybind1": {},
                "Keybind2": {},
            },
            macOnlyShortcuts: undefined,
            desktopShortcuts: ["Keybind2"],
        });
        mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(true) });
        expect(getKeyboardShortcuts()).toEqual({ "Keybind1": {}, "Keybind2": {} });
    });
});
