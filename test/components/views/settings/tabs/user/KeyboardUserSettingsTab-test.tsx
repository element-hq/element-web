
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
import { mount, ReactWrapper } from "enzyme";

import { Key } from "../../../../../../src/Keyboard";

const PATH_TO_KEYBOARD_SHORTCUTS = "../../../../../../src/accessibility/KeyboardShortcuts";
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

const renderKeyboardUserSettingsTab = async (component, props?): Promise<ReactWrapper> => {
    const Component = (await import(PATH_TO_COMPONENT))[component];
    return mount(<Component {...props} />);
};

describe("KeyboardUserSettingsTab", () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it("renders key icon", async () => {
        const body = await renderKeyboardUserSettingsTab("KeyboardKey", { name: Key.ARROW_DOWN });
        expect(body).toMatchSnapshot();
    });

    it("renders alternative key name", async () => {
        const body = await renderKeyboardUserSettingsTab("KeyboardKey", { name: Key.PAGE_DOWN });
        expect(body).toMatchSnapshot();
    });

    it("doesn't render + if last", async () => {
        const body = await renderKeyboardUserSettingsTab("KeyboardKey", { name: Key.A, last: true });
        expect(body).toMatchSnapshot();
    });

    it("doesn't render same modifier twice", async () => {
        mockKeyboardShortcuts({
            "KEYBOARD_SHORTCUTS": {
                "keybind1": {
                    default: {
                        key: Key.A,
                        ctrlOrCmdKey: true,
                        metaKey: true,
                    },
                    displayName: "Cancel replying to a message",
                },
            },
        });
        const body1 = await renderKeyboardUserSettingsTab("KeyboardShortcut", { name: "keybind1" });
        expect(body1).toMatchSnapshot();
        jest.resetModules();

        mockKeyboardShortcuts({
            "KEYBOARD_SHORTCUTS": {
                "keybind1": {
                    default: {
                        key: Key.A,
                        ctrlOrCmdKey: true,
                        ctrlKey: true,
                    },
                    displayName: "Cancel replying to a message",
                },
            },
        });
        const body2 = await renderKeyboardUserSettingsTab("KeyboardShortcut", { name: "keybind1" });
        expect(body2).toMatchSnapshot();
        jest.resetModules();
    });

    it("renders list of keyboard shortcuts", async () => {
        mockKeyboardShortcuts({
            "KEYBOARD_SHORTCUTS": {
                "keybind1": {
                    default: {
                        key: Key.A,
                        ctrlKey: true,
                    },
                    displayName: "Cancel replying to a message",
                },
                "keybind2": {
                    default: {
                        key: Key.B,
                        ctrlKey: true,
                    },
                    displayName: "Toggle Bold",
                },
                "keybind3": {
                    default: {
                        key: Key.ENTER,
                    },
                    displayName: "Select room from the room list",
                },
            },
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

        const body = await renderKeyboardUserSettingsTab("default");
        expect(body).toMatchSnapshot();
    });
});
