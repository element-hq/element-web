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

export enum KeyBindingAction {
    /** Send a message */
    SendMessage = 'KeyBinding.sendMessageInComposer',
    /** Go backwards through the send history and use the message in composer view */
    SelectPrevSendHistory = 'KeyBinding.previousMessageInComposerHistory',
    /** Go forwards through the send history */
    SelectNextSendHistory = 'KeyBinding.nextMessageInComposerHistory',
    /** Start editing the user's last sent message */
    EditPrevMessage = 'KeyBinding.editPreviousMessage',
    /** Start editing the user's next sent message */
    EditNextMessage = 'KeyBinding.editNextMessage',
    /** Cancel editing a message or cancel replying to a message */
    CancelReplyOrEdit = 'KeyBinding.cancelReplyInComposer',

    /** Set bold format the current selection */
    FormatBold = 'KeyBinding.toggleBoldInComposer',
    /** Set italics format the current selection */
    FormatItalics = 'KeyBinding.toggleItalicsInComposer',
    /** Format the current selection as quote */
    FormatQuote = 'KeyBinding.toggleQuoteInComposer',
    /** Undo the last editing */
    EditUndo = 'KeyBinding.editUndoInComposer',
    /** Redo editing */
    EditRedo = 'KeyBinding.editRedoInComposer',
    /** Insert new line */
    NewLine = 'KeyBinding.newLineInComposer',
    /** Move the cursor to the start of the message */
    MoveCursorToStart = 'KeyBinding.jumpToStartInComposer',
    /** Move the cursor to the end of the message */
    MoveCursorToEnd = 'KeyBinding.jumpToEndInComposer',

    /** Accepts chosen autocomplete selection */
    CompleteAutocomplete = 'KeyBinding.completeAutocomplete',
    /** Accepts chosen autocomplete selection or,
     * if the autocompletion window is not shown, open the window and select the first selection */
    ForceCompleteAutocomplete = 'KeyBinding.forceCompleteAutocomplete',
    /** Move to the previous autocomplete selection */
    PrevSelectionInAutocomplete = 'KeyBinding.previousOptionInAutoComplete',
    /** Move to the next autocomplete selection */
    NextSelectionInAutocomplete = 'KeyBinding.nextOptionInAutoComplete',
    /** Close the autocompletion window */
    CancelAutocomplete = 'KeyBinding.cancelAutoComplete',

    /** Clear room list filter field */
    ClearRoomFilter = 'KeyBinding.clearRoomFilter',
    /** Navigate up/down in the room list */
    PrevRoom = 'KeyBinding.downerRoom',
    /** Navigate down in the room list */
    NextRoom = 'KeyBinding.upperRoom',
    /** Select room from the room list */
    SelectRoomInRoomList = 'KeyBinding.selectRoomInRoomList',
    /** Collapse room list section */
    CollapseRoomListSection = 'KeyBinding.collapseSectionInRoomList',
    /** Expand room list section, if already expanded, jump to first room in the selection */
    ExpandRoomListSection = 'KeyBinding.expandSectionInRoomList',

    /** Scroll up in the timeline */
    ScrollUp = 'KeyBinding.scrollUpInTimeline',
    /** Scroll down in the timeline */
    ScrollDown = 'KeyBinding.scrollDownInTimeline',
    /** Dismiss read marker and jump to bottom */
    DismissReadMarker = 'KeyBinding.dismissReadMarkerAndJumpToBottom',
    /** Jump to oldest unread message */
    JumpToOldestUnread = 'KeyBinding.jumpToOldestUnreadMessage',
    /** Upload a file */
    UploadFile = 'KeyBinding.uploadFileToRoom',
    /** Focus search message in a room (must be enabled) */
    SearchInRoom = 'KeyBinding.searchInRoom',
    /** Jump to the first (downloaded) message in the room */
    JumpToFirstMessage = 'KeyBinding.jumpToFirstMessageInTimeline',
    /** Jump to the latest message in the room */
    JumpToLatestMessage = 'KeyBinding.jumpToLastMessageInTimeline',

    /** Jump to room search (search for a room) */
    FilterRooms = 'KeyBinding.filterRooms',
    /** Toggle the space panel */
    ToggleSpacePanel = 'KeyBinding.toggleSpacePanel',
    /** Toggle the room side panel */
    ToggleRoomSidePanel = 'KeyBinding.toggleRightPanel',
    /** Toggle the user menu */
    ToggleUserMenu = 'KeyBinding.toggleTopLeftMenu',
    /** Toggle the short cut help dialog */
    ShowKeyboardSettings = 'KeyBinding.showKeyBindingsSettings',
    /** Got to the Element home screen */
    GoToHome = 'KeyBinding.goToHomeView',
    /** Select prev room */
    SelectPrevRoom = 'KeyBinding.previousRoom',
    /** Select next room */
    SelectNextRoom = 'KeyBinding.nextRoom',
    /** Select prev room with unread messages */
    SelectPrevUnreadRoom = 'KeyBinding.previousUnreadRoom',
    /** Select next room with unread messages */
    SelectNextUnreadRoom = 'KeyBinding.nextUnreadRoom',

    /** Toggle visibility of hidden events */
    ToggleHiddenEventVisibility = 'KeyBinding.toggleHiddenEventVisibility',
}

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
            KeyBindingAction.SendMessage,
            KeyBindingAction.NewLine,
            KeyBindingAction.FormatBold,
            KeyBindingAction.FormatItalics,
            KeyBindingAction.FormatQuote,
            KeyBindingAction.EditUndo,
            KeyBindingAction.EditRedo,
            KeyBindingAction.MoveCursorToStart,
            KeyBindingAction.MoveCursorToEnd,
            KeyBindingAction.CancelReplyOrEdit,
            KeyBindingAction.EditNextMessage,
            KeyBindingAction.EditPrevMessage,
            KeyBindingAction.SelectNextSendHistory,
            KeyBindingAction.SelectPrevSendHistory,
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
            KeyBindingAction.SearchInRoom,
            KeyBindingAction.UploadFile,
            KeyBindingAction.DismissReadMarker,
            KeyBindingAction.JumpToOldestUnread,
            KeyBindingAction.ScrollUp,
            KeyBindingAction.ScrollDown,
            KeyBindingAction.JumpToFirstMessage,
            KeyBindingAction.JumpToLatestMessage,
        ],
    }, [CategoryName.ROOM_LIST]: {
        categoryLabel: _td("Room List"),
        settingNames: [
            KeyBindingAction.SelectRoomInRoomList,
            KeyBindingAction.ClearRoomFilter,
            KeyBindingAction.CollapseRoomListSection,
            KeyBindingAction.ExpandRoomListSection,
            KeyBindingAction.NextRoom,
            KeyBindingAction.PrevRoom,
        ],
    }, [CategoryName.NAVIGATION]: {
        categoryLabel: _td("Navigation"),
        settingNames: [
            KeyBindingAction.ToggleUserMenu,
            "KeyBinding.closeDialogOrContextMenu",
            "KeyBinding.activateSelectedButton",
            KeyBindingAction.ToggleRoomSidePanel,
            KeyBindingAction.ToggleSpacePanel,
            KeyBindingAction.ShowKeyboardSettings,
            KeyBindingAction.GoToHome,
            KeyBindingAction.FilterRooms,
            KeyBindingAction.SelectNextUnreadRoom,
            KeyBindingAction.SelectPrevUnreadRoom,
            KeyBindingAction.SelectNextRoom,
            KeyBindingAction.SelectPrevRoom,
        ],
    }, [CategoryName.AUTOCOMPLETE]: {
        categoryLabel: _td("Autocomplete"),
        settingNames: [
            KeyBindingAction.CancelAutocomplete,
            KeyBindingAction.NextSelectionInAutocomplete,
            KeyBindingAction.PrevSelectionInAutocomplete,
            KeyBindingAction.CompleteAutocomplete,
            KeyBindingAction.ForceCompleteAutocomplete,
        ],
    }, [CategoryName.LABS]: {
        categoryLabel: _td("Labs"),
        settingNames: [
            KeyBindingAction.ToggleHiddenEventVisibility,
        ],
    },
};

// This is very intentionally modelled after SETTINGS as it will make it easier
// to implement customizable keyboard shortcuts
// TODO: TravisR will fix this nightmare when the new version of the SettingsStore becomes a thing
const KEYBOARD_SHORTCUTS: IKeyboardShortcuts = {
    [KeyBindingAction.FormatBold]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.B,
        },
        displayName: _td("Toggle Bold"),
    },
    [KeyBindingAction.FormatItalics]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.I,
        },
        displayName: _td("Toggle Italics"),
    },
    [KeyBindingAction.FormatQuote]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.GREATER_THAN,
        },
        displayName: _td("Toggle Quote"),
    },
    [KeyBindingAction.CancelReplyOrEdit]: {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Cancel replying to a message"),
    },
    [KeyBindingAction.EditNextMessage]: {
        default: {
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Navigate to next message to edit"),
    },
    [KeyBindingAction.EditPrevMessage]: {
        default: {
            key: Key.ARROW_UP,
        },
        displayName: _td("Navigate to previous message to edit"),
    },
    [KeyBindingAction.MoveCursorToStart]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.HOME,
        },
        displayName: _td("Jump to start of the composer"),
    },
    [KeyBindingAction.MoveCursorToEnd]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.END,
        },
        displayName: _td("Jump to end of the composer"),
    },
    [KeyBindingAction.SelectNextSendHistory]: {
        default: {
            altKey: true,
            ctrlKey: true,
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Navigate to next message in composer history"),
    },
    [KeyBindingAction.SelectPrevSendHistory]: {
        default: {
            altKey: true,
            ctrlKey: true,
            key: Key.ARROW_UP,
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
    [KeyBindingAction.DismissReadMarker]: {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Dismiss read marker and jump to bottom"),
    },
    [KeyBindingAction.JumpToOldestUnread]: {
        default: {
            shiftKey: true,
            key: Key.PAGE_UP,
        },
        displayName: _td("Jump to oldest unread message"),
    },
    [KeyBindingAction.UploadFile]: {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.U,
        },
        displayName: _td("Upload a file"),
    },
    [KeyBindingAction.ScrollUp]: {
        default: {
            key: Key.PAGE_UP,
        },
        displayName: _td("Scroll up in the timeline"),
    },
    [KeyBindingAction.ScrollDown]: {
        default: {
            key: Key.PAGE_DOWN,
        },
        displayName: _td("Scroll down in the timeline"),
    },
    [KeyBindingAction.FilterRooms]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.K,
        },
        displayName: _td("Jump to room search"),
    },
    [KeyBindingAction.SelectRoomInRoomList]: {
        default: {
            key: Key.ENTER,
        },
        displayName: _td("Select room from the room list"),
    },
    [KeyBindingAction.CollapseRoomListSection]: {
        default: {
            key: Key.ARROW_LEFT,
        },
        displayName: _td("Collapse room list section"),
    },
    [KeyBindingAction.ExpandRoomListSection]: {
        default: {
            key: Key.ARROW_RIGHT,
        },
        displayName: _td("Expand room list section"),
    },
    [KeyBindingAction.ClearRoomFilter]: {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Clear room list filter field"),
    },
    [KeyBindingAction.NextRoom]: {
        default: {
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Navigate up in the room list"),
    },
    [KeyBindingAction.PrevRoom]: {
        default: {
            key: Key.ARROW_UP,
        },
        displayName: _td("Navigate down in the room list"),
    },
    [KeyBindingAction.ToggleUserMenu]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.BACKTICK,
        },
        displayName: _td("Toggle the top left menu"),
    },
    [KeyBindingAction.ToggleRoomSidePanel]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.PERIOD,
        },
        displayName: _td("Toggle right panel"),
    },
    [KeyBindingAction.ShowKeyboardSettings]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.SLASH,
        },
        displayName: _td("Open this settings tab"),
    },
    [KeyBindingAction.GoToHome]: {
        default: {
            ctrlOrCmdKey: true,
            altKey: !isMac,
            shiftKey: isMac,
            key: Key.H,
        },
        displayName: _td("Go to Home View"),
    },
    [KeyBindingAction.SelectNextUnreadRoom]: {
        default: {
            shiftKey: true,
            altKey: true,
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Next unread room or DM"),
    },
    [KeyBindingAction.SelectPrevUnreadRoom]: {
        default: {
            shiftKey: true,
            altKey: true,
            key: Key.ARROW_UP,
        },
        displayName: _td("Previous unread room or DM"),
    },
    [KeyBindingAction.SelectNextRoom]: {
        default: {
            altKey: true,
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Next room or DM"),
    },
    [KeyBindingAction.SelectPrevRoom]: {
        default: {
            altKey: true,
            key: Key.ARROW_UP,
        },
        displayName: _td("Previous room or DM"),
    },
    [KeyBindingAction.CancelAutocomplete]: {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("Cancel autocomplete"),
    },
    [KeyBindingAction.NextSelectionInAutocomplete]: {
        default: {
            key: Key.ARROW_DOWN,
        },
        displayName: _td("Next autocomplete suggestion"),
    },
    [KeyBindingAction.PrevSelectionInAutocomplete]: {
        default: {
            key: Key.ARROW_UP,
        },
        displayName: _td("Previous autocomplete suggestion"),
    },
    [KeyBindingAction.ToggleSpacePanel]: {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.D,
        },
        displayName: _td("Toggle space panel"),
    },
    [KeyBindingAction.ToggleHiddenEventVisibility]: {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.H,
        },
        displayName: _td("Toggle hidden event visibility"),
    },
    [KeyBindingAction.JumpToFirstMessage]: {
        default: {
            key: Key.HOME,
            ctrlKey: true,
        },
        displayName: _td("Jump to first message"),
    },
    [KeyBindingAction.JumpToLatestMessage]: {
        default: {
            key: Key.END,
            ctrlKey: true,
        },
        displayName: _td("Jump to last message"),
    },
    [KeyBindingAction.EditUndo]: {
        default: {
            key: Key.Z,
            ctrlOrCmdKey: true,
        },
        displayName: _td("Undo edit"),
    },
};

// XXX: These have to be manually mirrored in KeyBindingDefaults
const getNonCustomizableShortcuts = (): IKeyboardShortcuts => {
    const ctrlEnterToSend = SettingsStore.getValue('MessageComposerInput.ctrlEnterToSend');

    return {
        [KeyBindingAction.SendMessage]: {
            default: {
                key: Key.ENTER,
                ctrlOrCmdKey: ctrlEnterToSend,
            },
            displayName: _td("Send message"),
        },
        [KeyBindingAction.NewLine]: {
            default: {
                key: Key.ENTER,
                shiftKey: !ctrlEnterToSend,
            },
            displayName: _td("New line"),
        },
        [KeyBindingAction.CompleteAutocomplete]: {
            default: {
                key: Key.ENTER,
            },
            displayName: _td("Complete"),
        },
        [KeyBindingAction.ForceCompleteAutocomplete]: {
            default: {
                key: Key.TAB,
            },
            displayName: _td("Force complete"),
        },
        [KeyBindingAction.SearchInRoom]: {
            default: {
                ctrlOrCmdKey: true,
                key: Key.F,
            },
            displayName: _td("Search (must be enabled)"),
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
    };
};

export const getCustomizableShortcuts = (): IKeyboardShortcuts => {
    const keyboardShortcuts = KEYBOARD_SHORTCUTS;

    keyboardShortcuts[KeyBindingAction.EditRedo] = {
        default: {
            key: isMac ? Key.Z : Key.Y,
            ctrlOrCmdKey: true,
            shiftKey: isMac,
        },
        displayName: _td("Redo edit"),
    };

    return keyboardShortcuts;
};

export const getKeyboardShortcuts = (): IKeyboardShortcuts => {
    const entries = [
        ...Object.entries(getNonCustomizableShortcuts()),
        ...Object.entries(getCustomizableShortcuts()),
    ];

    const keyboardShortcuts: IKeyboardShortcuts = {};
    for (const [key, value] of entries) {
        keyboardShortcuts[key] = value;
    }
    return keyboardShortcuts;
};

export const registerShortcut = (shortcutName: string, categoryName: CategoryName, shortcut: ISetting): void => {
    KEYBOARD_SHORTCUTS[shortcutName] = shortcut;
    CATEGORIES[categoryName].settingNames.push(shortcutName);
};
