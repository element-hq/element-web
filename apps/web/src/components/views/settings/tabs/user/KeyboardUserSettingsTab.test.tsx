/*
Copyright 2024 New Vector Ltd.
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "test-utils-rtl";
import { mockPlatformPeg } from "test-utils";
import React from "react";

import KeyboardUserSettingsTab from "./KeyboardUserSettingsTab";
import { Key } from "../../../../../Keyboard";

const PATH_TO_KEYBOARD_SHORTCUTS = "../../../../../accessibility/KeyboardShortcuts";
const PATH_TO_KEYBOARD_SHORTCUT_UTILS = "../../../../../accessibility/KeyboardShortcutUtils";

const mockKeyboardShortcuts = (override: Record<string, any>) => {
    vi.doMock(PATH_TO_KEYBOARD_SHORTCUTS, async () => {
        const original = await vi.importActual(PATH_TO_KEYBOARD_SHORTCUTS);
        return {
            ...original,
            ...override,
        };
    });
};

const mockKeyboardShortcutUtils = (override: Record<string, any>) => {
    vi.doMock(PATH_TO_KEYBOARD_SHORTCUT_UTILS, async () => {
        const original = await vi.importActual(PATH_TO_KEYBOARD_SHORTCUT_UTILS);
        return {
            ...original,
            ...override,
        };
    });
};

const renderKeyboardUserSettingsTab = () => {
    return render(<KeyboardUserSettingsTab />).container;
};

describe("KeyboardUserSettingsTab", () => {
    beforeEach(() => {
        vi.resetModules();
        mockPlatformPeg();
    });

    it("renders list of keyboard shortcuts", () => {
        mockKeyboardShortcuts({
            CATEGORIES: {
                Composer: {
                    settingNames: ["keybind1", "keybind2"],
                    categoryLabel: "Composer",
                },
                Navigation: {
                    settingNames: ["keybind3"],
                    categoryLabel: "Navigation",
                },
            },
        });
        mockKeyboardShortcutUtils({
            getKeyboardShortcutValue: (name: string) => {
                switch (name) {
                    case "keybind1":
                        return {
                            key: Key.A,
                            ctrlKey: true,
                        };
                    case "keybind2": {
                        return {
                            key: Key.B,
                            ctrlKey: true,
                        };
                    }
                    case "keybind3": {
                        return {
                            key: Key.ENTER,
                        };
                    }
                }
            },
            getKeyboardShortcutDisplayName: (name: string) => {
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

        const body = renderKeyboardUserSettingsTab();
        expect(body).toMatchSnapshot();
    });
});
