/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { _td } from "../languageHandler";
import { isMac, Key } from "../Keyboard";

export enum Categories {
    NAVIGATION = "Navigation",
    CALLS = "Calls",
    COMPOSER = "Composer",
    ROOM_LIST = "Room List",
    ROOM = "Room",
    AUTOCOMPLETE = "Autocomplete",
}

export enum Modifiers {
    ALT = "Alt", // Option on Mac and displayed as an Icon
    ALT_GR = "Alt Gr",
    SHIFT = "Shift",
    SUPER = "Super", // should this be "Windows"?
    // Instead of using below, consider CMD_OR_CTRL
    COMMAND = "Command", // This gets displayed as an Icon
    CONTROL = "Ctrl",
}

// Meta-modifier: isMac ? CMD : CONTROL
export const CMD_OR_CTRL = isMac ? Modifiers.COMMAND : Modifiers.CONTROL;
// Meta-key representing the digits [0-9] often found at the top of standard keyboard layouts
export const DIGITS = "digits";

interface IKeybind {
    modifiers?: Modifiers[];
    key: string; // TS: fix this once Key is an enum
}

export interface IShortcut {
    keybinds: IKeybind[];
    description: string;
}

export const shortcuts: Record<Categories, IShortcut[]> = {
    [Categories.COMPOSER]: [
        {
            keybinds: [{
                modifiers: [CMD_OR_CTRL],
                key: Key.B,
            }],
            description: _td("Toggle Bold"),
        }, {
            keybinds: [{
                modifiers: [CMD_OR_CTRL],
                key: Key.I,
            }],
            description: _td("Toggle Italics"),
        }, {
            keybinds: [{
                modifiers: [CMD_OR_CTRL],
                key: Key.GREATER_THAN,
            }],
            description: _td("Toggle Quote"),
        }, {
            keybinds: [{
                modifiers: [Modifiers.SHIFT],
                key: Key.ENTER,
            }],
            description: _td("New line"),
        }, {
            keybinds: [{
                key: Key.ARROW_UP,
            }, {
                key: Key.ARROW_DOWN,
            }],
            description: _td("Navigate recent messages to edit"),
        }, {
            keybinds: [{
                modifiers: [CMD_OR_CTRL],
                key: Key.HOME,
            }, {
                modifiers: [CMD_OR_CTRL],
                key: Key.END,
            }],
            description: _td("Jump to start/end of the composer"),
        }, {
            keybinds: [{
                modifiers: [Modifiers.CONTROL, Modifiers.ALT],
                key: Key.ARROW_UP,
            }, {
                modifiers: [Modifiers.CONTROL, Modifiers.ALT],
                key: Key.ARROW_DOWN,
            }],
            description: _td("Navigate composer history"),
        }, {
            keybinds: [{
                key: Key.ESCAPE,
            }],
            description: _td("Cancel replying to a message"),
        },
    ],

    [Categories.CALLS]: [
        {
            keybinds: [{
                modifiers: [CMD_OR_CTRL],
                key: Key.D,
            }],
            description: _td("Toggle microphone mute"),
        }, {
            keybinds: [{
                modifiers: [CMD_OR_CTRL],
                key: Key.E,
            }],
            description: _td("Toggle video on/off"),
        },
    ],

    [Categories.ROOM]: [
        {
            keybinds: [{
                key: Key.PAGE_UP,
            }, {
                key: Key.PAGE_DOWN,
            }],
            description: _td("Scroll up/down in the timeline"),
        }, {
            keybinds: [{
                key: Key.ESCAPE,
            }],
            description: _td("Dismiss read marker and jump to bottom"),
        }, {
            keybinds: [{
                modifiers: [Modifiers.SHIFT],
                key: Key.PAGE_UP,
            }],
            description: _td("Jump to oldest unread message"),
        }, {
            keybinds: [{
                modifiers: [CMD_OR_CTRL, Modifiers.SHIFT],
                key: Key.U,
            }],
            description: _td("Upload a file"),
        }, {
            keybinds: [{
                modifiers: [CMD_OR_CTRL],
                key: Key.F,
            }],
            description: _td("Search (must be enabled)"),
        },
    ],

    [Categories.ROOM_LIST]: [
        {
            keybinds: [{
                modifiers: [CMD_OR_CTRL],
                key: Key.K,
            }],
            description: _td("Jump to room search"),
        }, {
            keybinds: [{
                key: Key.ARROW_UP,
            }, {
                key: Key.ARROW_DOWN,
            }],
            description: _td("Navigate up/down in the room list"),
        }, {
            keybinds: [{
                key: Key.ENTER,
            }],
            description: _td("Select room from the room list"),
        }, {
            keybinds: [{
                key: Key.ARROW_LEFT,
            }],
            description: _td("Collapse room list section"),
        }, {
            keybinds: [{
                key: Key.ARROW_RIGHT,
            }],
            description: _td("Expand room list section"),
        }, {
            keybinds: [{
                key: Key.ESCAPE,
            }],
            description: _td("Clear room list filter field"),
        },
    ],

    [Categories.NAVIGATION]: [
        {
            keybinds: [{
                modifiers: [Modifiers.ALT, Modifiers.SHIFT],
                key: Key.ARROW_UP,
            }, {
                modifiers: [Modifiers.ALT, Modifiers.SHIFT],
                key: Key.ARROW_DOWN,
            }],
            description: _td("Previous/next unread room or DM"),
        }, {
            keybinds: [{
                modifiers: [Modifiers.ALT],
                key: Key.ARROW_UP,
            }, {
                modifiers: [Modifiers.ALT],
                key: Key.ARROW_DOWN,
            }],
            description: _td("Previous/next room or DM"),
        }, {
            keybinds: [{
                modifiers: [CMD_OR_CTRL],
                key: Key.BACKTICK,
            }],
            description: _td("Toggle the top left menu"),
        }, {
            keybinds: [{
                key: Key.ESCAPE,
            }],
            description: _td("Close dialog or context menu"),
        }, {
            keybinds: [{
                key: Key.ENTER,
            }, {
                key: Key.SPACE,
            }],
            description: _td("Activate selected button"),
        }, {
            keybinds: [{
                modifiers: [CMD_OR_CTRL, Modifiers.SHIFT],
                key: Key.D,
            }],
            description: _td("Toggle space panel"),
        }, {
            keybinds: [{
                modifiers: [CMD_OR_CTRL],
                key: Key.PERIOD,
            }],
            description: _td("Toggle right panel"),
        }, {
            keybinds: [{
                modifiers: [CMD_OR_CTRL],
                key: Key.SLASH,
            }],
            description: _td("Open this settings tab"),
        }, {
            keybinds: [{
                modifiers: [Modifiers.CONTROL, isMac ? Modifiers.SHIFT : Modifiers.ALT],
                key: Key.H,
            }],
            description: _td("Go to Home View"),
        },
    ],

    [Categories.AUTOCOMPLETE]: [
        {
            keybinds: [{
                key: Key.ARROW_UP,
            }, {
                key: Key.ARROW_DOWN,
            }],
            description: _td("Move autocomplete selection up/down"),
        }, {
            keybinds: [{
                key: Key.ESCAPE,
            }],
            description: _td("Cancel autocomplete"),
        },
    ],
};

export const registerShortcut = (category: Categories, defn: IShortcut) => {
    shortcuts[category].push(defn);
};
