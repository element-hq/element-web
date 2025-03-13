/*
Copyright 2024 New Vector Ltd.
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mockPlatformPeg, unmockPlatformPeg } from "../../test-utils";

const PATH_TO_KEYBOARD_SHORTCUTS = "../../../src/accessibility/KeyboardShortcuts";
const PATH_TO_KEYBOARD_SHORTCUT_UTILS = "../../../src/accessibility/KeyboardShortcutUtils";

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
