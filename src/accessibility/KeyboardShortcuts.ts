/*
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2021 - 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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
import { ISetting } from "../settings/Settings";

export interface ICategory {
    categoryLabel: string;
    settingNames: string[];
}

export enum CategoryName {
    NAVIGATION = "Navigation",
    CALLS = "Calls",
    COMPOSER = "Composer",
    ROOM_LIST = "Room List",
    ROOM = "Room",
    AUTOCOMPLETE = "Autocomplete",
}

// Meta-key representing the digits [0-9] often found at the top of standard keyboard layouts
export const DIGITS = "digits";

export const ALTERNATE_KEY_NAME: Record<string, string> = {
    [Key.PAGE_UP]: _td("Page Up"),
    [Key.PAGE_DOWN]: _td("Page Down"),
    [Key.ESCAPE]: _td("Esc"),
    [Key.ENTER]: _td("Enter"),
    [Key.SPACE]: _td("Space"),
    [Key.HOME]: _td("Home"),
    [Key.END]: _td("End"),
    [Key.ALT]: _td("Alt"),
    [Key.CONTROL]: _td("Ctrl"),
    [Key.SHIFT]: _td("Shift"),
    [DIGITS]: _td("[number]"),
};
export const KEY_ICON: Record<string, string> = {
    [Key.ARROW_UP]: "↑",
    [Key.ARROW_DOWN]: "↓",
    [Key.ARROW_LEFT]: "←",
    [Key.ARROW_RIGHT]: "→",
};
if (isMac) {
    KEY_ICON[Key.META] = "⌘";
    KEY_ICON[Key.SHIFT] = "⌥";
}

export const CATEGORIES: Record<CategoryName, ICategory> = {
    [CategoryName.COMPOSER]: {
        categoryLabel: _td("Composer"),
        settingNames: [
            "KeyBinding.toggleBoldInComposer",
            "KeyBinding.toggleItalicsInComposer",
            "KeyBinding.toggleQuoteInComposer",
            "KeyBinding.newLineInComposer",
            "KeyBinding.cancelReplyInComposer",
            "KeyBinding.editNextMessage",
            "KeyBinding.editPreviousMessage",
            "KeyBinding.jumpToStartInComposer",
            "KeyBinding.jumpToEndInComposer",
            "KeyBinding.nextMessageInComposerHistory",
            "KeyBinding.previousMessageInComposerHistory",
        ],
    }, [CategoryName.CALLS]: {
        categoryLabel: _td("Calls"),
        settingNames: [
            "KeyBinding.toggleMicInCall",
            "KeyBinding.toggleWebcamInCall",
        ],
    }, [CategoryName.ROOM]: {
        categoryLabel: _td("Room"),
        settingNames: [
            "KeyBinding.dismissReadMarkerAndJumpToBottom",
            "KeyBinding.jumpToOldestUnreadMessage",
            "KeyBinding.uploadFileToRoom",
            "KeyBinding.searchInRoom",
            "KeyBinding.scrollUpInTimeline",
            "KeyBinding.scrollDownInTimeline",
        ],
    }, [CategoryName.ROOM_LIST]: {
        categoryLabel: _td("Room List"),
        settingNames: [
            "KeyBinding.filterRooms",
            "KeyBinding.selectRoomInRoomList",
            "KeyBinding.collapseSectionInRoomList",
            "KeyBinding.expandSectionInRoomList",
            "KeyBinding.clearRoomFilter",
            "KeyBinding.upperRoom",
            "KeyBinding.downerRoom",
        ],
    }, [CategoryName.NAVIGATION]: {
        categoryLabel: _td("Navigation"),
        settingNames: [
            "KeyBinding.toggleTopLeftMenu",
            "KeyBinding.closeDialogOrContextMenu",
            "KeyBinding.activateSelectedButton",
            "KeyBinding.toggleRightPanel",
            "KeyBinding.showKeyBindingsSettings",
            "KeyBinding.goToHomeView",
            "KeyBinding.nextUnreadRoom",
            "KeyBinding.previousUnreadRoom",
            "KeyBinding.nextRoom",
            "KeyBinding.previousRoom",
            "KeyBinding.toggleSpacePanel",
        ],
    }, [CategoryName.AUTOCOMPLETE]: {
        categoryLabel: _td("Autocomplete"),
        settingNames: [
            "KeyBinding.cancelAutoComplete",
            "KeyBinding.nextOptionInAutoComplete",
            "KeyBinding.previousOptionInAutoComplete",
        ],
    },
};

// This is very intentionally modelled after SETTINGS as it will make it easier
// to implement customizable keyboard shortcuts
// TODO: TravisR will fix this nightmare when the new version of the SettingsStore becomes a thing
export const KEYBOARD_SHORTCUTS: { [setting: string]: ISetting } = {
    "KeyBinding.toggleBoldInComposer": {
        default: {
            ctrlOrCmdKey: true,
            key: Key.B,
        },
        displayName: _td("Toggle Bold"),
    },
    "KeyBinding.toggleItalicsInComposer": {
        default: {
            ctrlOrCmdKey: true,
            key: Key.I,
        },
        displayName: _td("Toggle Italics"),
    },
    "KeyBinding.toggleQuoteInComposer": {
        default: {
            ctrlOrCmdKey: true,
            key: Key.GREATER_THAN,
        },
        displayName: _td("Toggle Quote"),
    },
    "KeyBinding.newLineInComposer": {
        default: {
            shiftKey: true,
            key: Key.ENTER,
        },
        displayName: _td("New line"),
    },
    "KeyBinding.cancelReplyInComposer": {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Cancel replying to a message"),
    },
    "KeyBinding.editNextMessage": {
        default: {
            key: Key.ARROW_UP,
        },
        displayName: _td("Navigate to next message to edit"),
    },
    "KeyBinding.editPreviousMessage": {
        default: {
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Navigate to previous message to edit"),
    },
    "KeyBinding.jumpToStartInComposer": {
        default: {
            ctrlOrCmdKey: true,
            key: Key.HOME,
        },
        displayName: _td("Jump to start of the composer"),
    },
    "KeyBinding.jumpToEndInComposer": {
        default: {
            ctrlOrCmdKey: true,
            key: Key.END,
        },
        displayName: _td("Jump to end of the composer"),
    },
    "KeyBinding.nextMessageInComposerHistory": {
        default: {
            altKey: true,
            ctrlKey: true,
            key: Key.ARROW_UP,
        },
        displayName: _td("Navigate to next message in composer history"),
    },
    "KeyBinding.previousMessageInComposerHistory": {
        default: {
            altKey: true,
            ctrlKey: true,
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Navigate to previous message in composer history"),
    },
    "KeyBinding.toggleMicInCall": {
        default: {
            ctrlOrCmdKey: true,
            key: Key.D,
        },
        displayName: _td("Toggle microphone mute"),
    },
    "KeyBinding.toggleWebcamInCall": {
        default: {
            ctrlOrCmdKey: true,
            key: Key.E,
        },
        displayName: _td("Toggle webcam on/off"),
    },
    "KeyBinding.dismissReadMarkerAndJumpToBottom": {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Dismiss read marker and jump to bottom"),
    },
    "KeyBinding.jumpToOldestUnreadMessage": {
        default: {
            shiftKey: true,
            key: Key.PAGE_UP,
        },
        displayName: _td("Jump to oldest unread message"),
    },
    "KeyBinding.uploadFileToRoom": {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.U,
        },
        displayName: _td("Upload a file"),
    },
    "KeyBinding.searchInRoom": {
        default: {
            ctrlOrCmdKey: true,
            key: Key.F,
        },
        displayName: _td("Search (must be enabled)"),
    },
    "KeyBinding.scrollUpInTimeline": {
        default: {
            key: Key.PAGE_UP,
        },
        displayName: _td("Scroll up in the timeline"),
    },
    "KeyBinding.scrollDownInTimeline": {
        default: {
            key: Key.PAGE_DOWN,
        },
        displayName: _td("Scroll down in the timeline"),
    },
    "KeyBinding.filterRooms": {
        default: {
            ctrlOrCmdKey: true,
            key: Key.K,
        },
        displayName: _td("Jump to room search"),
    },
    "KeyBinding.selectRoomInRoomList": {
        default: {
            key: Key.ENTER,
        },
        displayName: _td("Select room from the room list"),
    },
    "KeyBinding.collapseSectionInRoomList": {
        default: {
            key: Key.ARROW_LEFT,
        },
        displayName: _td("Collapse room list section"),
    },
    "KeyBinding.expandSectionInRoomList": {
        default: {
            key: Key.ARROW_RIGHT,
        },
        displayName: _td("Expand room list section"),
    },
    "KeyBinding.clearRoomFilter": {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Clear room list filter field"),
    },
    "KeyBinding.upperRoom": {
        default: {
            key: Key.ARROW_UP,
        },
        displayName: _td("Navigate up in the room list"),
    },
    "KeyBinding.downerRoom": {
        default: {
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Navigate down in the room list"),
    },
    "KeyBinding.toggleTopLeftMenu": {
        default: {
            ctrlOrCmdKey: true,
            key: Key.BACKTICK,
        },
        displayName: _td("Toggle the top left menu"),
    },
    "KeyBinding.closeDialogOrContextMenu": {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Close dialog or context menu"),
    },
    "KeyBinding.activateSelectedButton": {
        default: {
            key: Key.ENTER,
        },
        displayName: _td("Activate selected button"),
    },
    "KeyBinding.toggleRightPanel": {
        default: {
            ctrlOrCmdKey: true,
            key: Key.PERIOD,
        },
        displayName: _td("Toggle right panel"),
    },
    "KeyBinding.showKeyBindingsSettings": {
        default: {
            ctrlOrCmdKey: true,
            key: Key.SLASH,
        },
        displayName: _td("Open this settings tab"),
    },
    "KeyBinding.goToHomeView": {
        default: {
            ctrlOrCmdKey: true,
            altKey: !isMac,
            shiftKey: isMac,
            key: Key.H,
        },
        displayName: _td("Go to Home View"),
    },
    "KeyBinding.nextUnreadRoom": {
        default: {
            shiftKey: true,
            altKey: true,
            key: Key.ARROW_UP,
        },
        displayName: _td("Next unread room or DM"),
    },
    "KeyBinding.previousUnreadRoom": {
        default: {
            shiftKey: true,
            altKey: true,
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Previous unread room or DM"),
    },
    "KeyBinding.nextRoom": {
        default: {
            altKey: true,
            key: Key.ARROW_UP,
        },
        displayName: _td("Next room or DM"),
    },
    "KeyBinding.previousRoom": {
        default: {
            altKey: true,
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Previous room or DM"),
    },
    "KeyBinding.cancelAutoComplete": {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Cancel autocomplete"),
    },
    "KeyBinding.nextOptionInAutoComplete": {
        default: {
            key: Key.ARROW_UP,
        },
        displayName: _td("Next autocomplete suggestion"),
    },
    "KeyBinding.previousOptionInAutoComplete": {
        default: {
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Previous autocomplete suggestion"),
    },
    "KeyBinding.toggleSpacePanel": {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.D,
        },
        displayName: _td("Toggle space panel"),
    },
};

export const registerShortcut = (shortcutName: string, categoryName: CategoryName, shortcut: ISetting): void => {
    KEYBOARD_SHORTCUTS[shortcutName] = shortcut;
    CATEGORIES[categoryName].settingNames.push(shortcutName);
};
