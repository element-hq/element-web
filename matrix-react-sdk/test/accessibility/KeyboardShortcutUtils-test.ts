/*
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>
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

import { mockPlatformPeg, unmockPlatformPeg } from "../test-utils";

const PATH_TO_KEYBOARD_SHORTCUTS = "../../src/accessibility/KeyboardShortcuts";
const PATH_TO_KEYBOARD_SHORTCUT_UTILS = "../../src/accessibility/KeyboardShortcutUtils";

const mockKeyboardShortcuts = (override: Record<string, any>) => {
    jest.doMock(PATH_TO_KEYBOARD_SHORTCUTS, () => {
        const original = jest.requireActual(PATH_TO_KEYBOARD_SHORTCUTS);
        return {
            ...original,
            ...override,
        };
    });
};
const getFile = async () => await import(PATH_TO_KEYBOARD_SHORTCUTS);
const getUtils = async () => await import(PATH_TO_KEYBOARD_SHORTCUT_UTILS);

describe("KeyboardShortcutUtils", () => {
    beforeEach(() => {
        unmockPlatformPeg();
        jest.resetModules();
    });

    it("doesn't change KEYBOARD_SHORTCUTS when getting shortcuts", async () => {
        mockKeyboardShortcuts({
            KEYBOARD_SHORTCUTS: {
                Keybind1: {},
                Keybind2: {},
            },
            MAC_ONLY_SHORTCUTS: ["Keybind1"],
            DESKTOP_SHORTCUTS: ["Keybind2"],
        });
        mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
        const utils = await getUtils();
        const file = await getFile();
        const copyKeyboardShortcuts = Object.assign({}, file.KEYBOARD_SHORTCUTS);

        utils.getKeyboardShortcuts();
        expect(file.KEYBOARD_SHORTCUTS).toEqual(copyKeyboardShortcuts);
        utils.getKeyboardShortcutsForUI();
        expect(file.KEYBOARD_SHORTCUTS).toEqual(copyKeyboardShortcuts);
    });

    describe("correctly filters shortcuts", () => {
        it("when on web and not on macOS", async () => {
            mockKeyboardShortcuts({
                KEYBOARD_SHORTCUTS: {
                    Keybind1: {},
                    Keybind2: {},
                    Keybind3: { controller: { settingDisabled: true } },
                    Keybind4: {},
                },
                MAC_ONLY_SHORTCUTS: ["Keybind1"],
                DESKTOP_SHORTCUTS: ["Keybind2"],
            });
            mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
            expect((await getUtils()).getKeyboardShortcuts()).toEqual({ Keybind4: {} });
        });

        it("when on desktop", async () => {
            mockKeyboardShortcuts({
                KEYBOARD_SHORTCUTS: {
                    Keybind1: {},
                    Keybind2: {},
                },
                MAC_ONLY_SHORTCUTS: [],
                DESKTOP_SHORTCUTS: ["Keybind2"],
            });
            mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(true) });
            expect((await getUtils()).getKeyboardShortcuts()).toEqual({ Keybind1: {}, Keybind2: {} });
        });
    });
});
