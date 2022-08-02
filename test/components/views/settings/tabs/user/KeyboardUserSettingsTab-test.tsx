
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

import React from "react";
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from "enzyme";

import { Key } from "../../../../../../src/Keyboard";

const PATH_TO_KEYBOARD_SHORTCUTS = "../../../../../../src/accessibility/KeyboardShortcuts";
const PATH_TO_KEYBOARD_SHORTCUT_UTILS = "../../../../../../src/accessibility/KeyboardShortcutUtils";
const PATH_TO_COMPONENT = "../../../../../../src/components/views/settings/tabs/user/KeyboardUserSettingsTab";

const mockKeyboardShortcuts = (override) => {
    jest.doMock(PATH_TO_KEYBOARD_SHORTCUTS, () => {
        const original = jest.requireActual(PATH_TO_KEYBOARD_SHORTCUTS);
        return {
            ...original,
            ...override,
        };
    });
};

const mockKeyboardShortcutUtils = (override) => {
    jest.doMock(PATH_TO_KEYBOARD_SHORTCUT_UTILS, () => {
        const original = jest.requireActual(PATH_TO_KEYBOARD_SHORTCUT_UTILS);
        return {
            ...original,
            ...override,
        };
    });
};

const renderKeyboardUserSettingsTab = async (component): Promise<ReactWrapper> => {
    const Component = (await import(PATH_TO_COMPONENT))[component];
    return mount(<Component />);
};

describe("KeyboardUserSettingsTab", () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it("renders list of keyboard shortcuts", async () => {
        mockKeyboardShortcuts({
            "CATEGORIES": {
                "Composer": {
                    settingNames: ["keybind1", "keybind2"],
                    categoryLabel: "Composer",
                },
                "Navigation": {
                    settingNames: ["keybind3"],
                    categoryLabel: "Navigation",
                },
            },
        });
        mockKeyboardShortcutUtils({
            "getKeyboardShortcutValue": (name) => {
                switch (name) {
                    case "keybind1":
                        return {
                            key: Key.A,
                            ctrlKey: true,
                        };
                    case "keybind2": {
                        return {
                            key: Key.B,
                            ctrlKey: true };
                    }
                    case "keybind3": {
                        return {
                            key: Key.ENTER,
                        };
                    }
                }
            },
            "getKeyboardShortcutDisplayName": (name) => {
                switch (name) {
                    case "keybind1":
                        return "Cancel replying to a message";
                    case "keybind2":
                        return "Toggle Bold";

                    case "keybind3":
                        return "Select room from the room list";
                }
            },
        });

        const body = await renderKeyboardUserSettingsTab("default");
        expect(body).toMatchSnapshot();
    });
});
