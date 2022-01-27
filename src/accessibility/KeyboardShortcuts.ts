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
import SettingsStore from "../settings/SettingsStore";
import {
    AutocompleteAction,
    KeyBindingAction,
    LabsAction,
    MessageComposerAction,
    NavigationAction,
    RoomAction,
    RoomListAction,
} from "../KeyBindingsManager";

type IKeyboardShortcuts = {
    // TODO: We should figure out what to do with the keyboard shortcuts that are not handled by KeybindingManager
    [k in (KeyBindingAction | string)]: ISetting;
};

export interface ICategory {
    categoryLabel: string;
    // TODO: We should figure out what to do with the keyboard shortcuts that are not handled by KeybindingManager
    settingNames: (KeyBindingAction | string)[];
}

export enum CategoryName {
    NAVIGATION = "Navigation",
    CALLS = "Calls",
    COMPOSER = "Composer",
    ROOM_LIST = "Room List",
    ROOM = "Room",
    AUTOCOMPLETE = "Autocomplete",
    LABS = "Labs",
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
            MessageComposerAction.Send,
            MessageComposerAction.FormatBold,
            MessageComposerAction.FormatItalics,
            MessageComposerAction.FormatQuote,
            MessageComposerAction.NewLine,
            MessageComposerAction.CancelEditing,
            MessageComposerAction.EditNextMessage,
            MessageComposerAction.EditPrevMessage,
            MessageComposerAction.MoveCursorToStart,
            MessageComposerAction.MoveCursorToEnd,
            MessageComposerAction.SelectNextSendHistory,
            MessageComposerAction.EditPrevMessage,
            MessageComposerAction.EditUndo,
            MessageComposerAction.EditRedo,
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
            RoomAction.DismissReadMarker,
            RoomAction.JumpToOldestUnread,
            RoomAction.UploadFile,
            RoomAction.FocusSearch,
            RoomAction.ScrollUp,
            RoomAction.RoomScrollDown,
            RoomAction.JumpToFirstMessage,
            RoomAction.JumpToLatestMessage,
        ],
    }, [CategoryName.ROOM_LIST]: {
        categoryLabel: _td("Room List"),
        settingNames: [
            RoomListAction.SelectRoom,
            RoomListAction.CollapseSection,
            RoomListAction.ExpandSection,
            RoomListAction.ClearSearch,
            RoomListAction.NextRoom,
            RoomListAction.PrevRoom,
        ],
    }, [CategoryName.NAVIGATION]: {
        categoryLabel: _td("Navigation"),
        settingNames: [
            NavigationAction.ToggleUserMenu,
            "KeyBinding.closeDialogOrContextMenu",
            "KeyBinding.activateSelectedButton",
            NavigationAction.ToggleRoomSidePanel,
            NavigationAction.OpenShortCutDialog,
            NavigationAction.GoToHome,
            NavigationAction.SelectNextUnreadRoom,
            NavigationAction.SelectPrevUnreadRoom,
            NavigationAction.SelectNextRoom,
            NavigationAction.SelectPrevRoom,
            NavigationAction.ToggleSpacePanel,
            NavigationAction.FocusRoomSearch,
        ],
    }, [CategoryName.AUTOCOMPLETE]: {
        categoryLabel: _td("Autocomplete"),
        settingNames: [
            AutocompleteAction.Cancel,
            AutocompleteAction.NextSelection,
            AutocompleteAction.PrevSelection,
            AutocompleteAction.Complete,
            AutocompleteAction.ForceComplete,
        ],
    }, [CategoryName.LABS]: {
        categoryLabel: _td("Labs"),
        settingNames: [
            LabsAction.ToggleHiddenEventVisibility,
        ],
    },
};

// This is very intentionally modelled after SETTINGS as it will make it easier
// to implement customizable keyboard shortcuts
// TODO: TravisR will fix this nightmare when the new version of the SettingsStore becomes a thing
const KEYBOARD_SHORTCUTS: IKeyboardShortcuts = {
    [MessageComposerAction.FormatBold]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.B,
        },
        displayName: _td("Toggle Bold"),
    },
    [MessageComposerAction.FormatItalics]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.I,
        },
        displayName: _td("Toggle Italics"),
    },
    [MessageComposerAction.FormatQuote]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.GREATER_THAN,
        },
        displayName: _td("Toggle Quote"),
    },
    [MessageComposerAction.CancelEditing]: {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Cancel replying to a message"),
    },
    [MessageComposerAction.EditNextMessage]: {
        default: {
            key: Key.ARROW_UP,
        },
        displayName: _td("Navigate to next message to edit"),
    },
    [MessageComposerAction.EditPrevMessage]: {
        default: {
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Navigate to previous message to edit"),
    },
    [MessageComposerAction.MoveCursorToStart]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.HOME,
        },
        displayName: _td("Jump to start of the composer"),
    },
    [MessageComposerAction.MoveCursorToEnd]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.END,
        },
        displayName: _td("Jump to end of the composer"),
    },
    [MessageComposerAction.SelectNextSendHistory]: {
        default: {
            altKey: true,
            ctrlKey: true,
            key: Key.ARROW_UP,
        },
        displayName: _td("Navigate to next message in composer history"),
    },
    [MessageComposerAction.SelectPrevSendHistory]: {
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
    [RoomAction.DismissReadMarker]: {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Dismiss read marker and jump to bottom"),
    },
    [RoomAction.JumpToOldestUnread]: {
        default: {
            shiftKey: true,
            key: Key.PAGE_UP,
        },
        displayName: _td("Jump to oldest unread message"),
    },
    [RoomAction.UploadFile]: {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.U,
        },
        displayName: _td("Upload a file"),
    },
    [RoomAction.FocusSearch]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.F,
        },
        displayName: _td("Search (must be enabled)"),
    },
    [RoomAction.ScrollUp]: {
        default: {
            key: Key.PAGE_UP,
        },
        displayName: _td("Scroll up in the timeline"),
    },
    [RoomAction.RoomScrollDown]: {
        default: {
            key: Key.PAGE_DOWN,
        },
        displayName: _td("Scroll down in the timeline"),
    },
    [NavigationAction.FocusRoomSearch]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.K,
        },
        displayName: _td("Jump to room search"),
    },
    [RoomListAction.SelectRoom]: {
        default: {
            key: Key.ENTER,
        },
        displayName: _td("Select room from the room list"),
    },
    [RoomListAction.CollapseSection]: {
        default: {
            key: Key.ARROW_LEFT,
        },
        displayName: _td("Collapse room list section"),
    },
    [RoomListAction.ExpandSection]: {
        default: {
            key: Key.ARROW_RIGHT,
        },
        displayName: _td("Expand room list section"),
    },
    [RoomListAction.ClearSearch]: {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Clear room list filter field"),
    },
    [RoomListAction.NextRoom]: {
        default: {
            key: Key.ARROW_UP,
        },
        displayName: _td("Navigate up in the room list"),
    },
    [RoomListAction.PrevRoom]: {
        default: {
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Navigate down in the room list"),
    },
    [NavigationAction.ToggleUserMenu]: {
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
    [NavigationAction.ToggleRoomSidePanel]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.PERIOD,
        },
        displayName: _td("Toggle right panel"),
    },
    [NavigationAction.OpenShortCutDialog]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.SLASH,
        },
        displayName: _td("Open this settings tab"),
    },
    [NavigationAction.GoToHome]: {
        default: {
            ctrlOrCmdKey: true,
            altKey: !isMac,
            shiftKey: isMac,
            key: Key.H,
        },
        displayName: _td("Go to Home View"),
    },
    [NavigationAction.SelectNextUnreadRoom]: {
        default: {
            shiftKey: true,
            altKey: true,
            key: Key.ARROW_UP,
        },
        displayName: _td("Next unread room or DM"),
    },
    [NavigationAction.SelectPrevUnreadRoom]: {
        default: {
            shiftKey: true,
            altKey: true,
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Previous unread room or DM"),
    },
    [NavigationAction.SelectNextRoom]: {
        default: {
            altKey: true,
            key: Key.ARROW_UP,
        },
        displayName: _td("Next room or DM"),
    },
    [NavigationAction.SelectPrevRoom]: {
        default: {
            altKey: true,
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Previous room or DM"),
    },
    [AutocompleteAction.Cancel]: {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Cancel autocomplete"),
    },
    [AutocompleteAction.NextSelection]: {
        default: {
            key: Key.ARROW_UP,
        },
        displayName: _td("Next autocomplete suggestion"),
    },
    [AutocompleteAction.PrevSelection]: {
        default: {
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Previous autocomplete suggestion"),
    },
    [NavigationAction.ToggleSpacePanel]: {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.D,
        },
        displayName: _td("Toggle space panel"),
    },
    [LabsAction.ToggleHiddenEventVisibility]: {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.H,
        },
        displayName: _td("Toggle hidden event visibility"),
    },
    [RoomAction.JumpToFirstMessage]: {
        default: {
            key: Key.HOME,
            ctrlKey: true,
        },
        displayName: _td("Jump to first message"),
    },
    [RoomAction.JumpToOldestUnread]: {
        default: {
            key: Key.END,
            ctrlKey: true,
        },
        displayName: _td("Jump to last message"),
    },
    [MessageComposerAction.EditUndo]: {
        default: {
            key: Key.Z,
            ctrlOrCmdKey: true,
        },
        displayName: _td("Undo edit"),
    },
    [AutocompleteAction.Complete]: {
        default: {
            key: Key.ENTER,
        },
        displayName: _td("Complete"),
    },
    [AutocompleteAction.ForceComplete]: {
        default: {
            key: Key.TAB,
        },
        displayName: _td("Force complete"),
    },
};

export const getKeyboardShortcuts = (): IKeyboardShortcuts => {
    const keyboardShortcuts = KEYBOARD_SHORTCUTS;
    const ctrlEnterToSend = SettingsStore.getValue('MessageComposerInput.ctrlEnterToSend');

    keyboardShortcuts[MessageComposerAction.Send] = {
        default: {
            key: Key.ENTER,
            ctrlOrCmdKey: ctrlEnterToSend,
        },
        displayName: _td("Send message"),

    };
    keyboardShortcuts[MessageComposerAction.NewLine] = {
        default: {
            key: Key.ENTER,
            shiftKey: !ctrlEnterToSend,
        },
        displayName: _td("New line"),
    };
    keyboardShortcuts[MessageComposerAction.EditRedo] = {
        default: {
            key: isMac ? Key.Z : Key.Y,
            ctrlOrCmdKey: true,
            shiftKey: isMac,
        },
        displayName: _td("Redo edit"),
    };

    return keyboardShortcuts;
};

export const registerShortcut = (shortcutName: string, categoryName: CategoryName, shortcut: ISetting): void => {
    KEYBOARD_SHORTCUTS[shortcutName] = shortcut;
    CATEGORIES[categoryName].settingNames.push(shortcutName);
};
