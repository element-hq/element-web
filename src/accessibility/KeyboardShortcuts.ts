/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2021, 2022 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { _td, type TranslationKey } from "../languageHandler";
import { IS_MAC, IS_ELECTRON, Key } from "../Keyboard";
import { type IBaseSetting } from "../settings/Settings";
import { type KeyCombo } from "../KeyBindingsManager";

export enum KeyBindingAction {
    /** Send a message */
    SendMessage = "KeyBinding.sendMessageInComposer",
    /** Go backwards through the send history and use the message in composer view */
    SelectPrevSendHistory = "KeyBinding.previousMessageInComposerHistory",
    /** Go forwards through the send history */
    SelectNextSendHistory = "KeyBinding.nextMessageInComposerHistory",
    /** Start editing the user's last sent message */
    EditPrevMessage = "KeyBinding.editPreviousMessage",
    /** Start editing the user's next sent message */
    EditNextMessage = "KeyBinding.editNextMessage",
    /** Cancel editing a message or cancel replying to a message */
    CancelReplyOrEdit = "KeyBinding.cancelReplyInComposer",
    /** Show the sticker picker */
    ShowStickerPicker = "KeyBinding.showStickerPicker",

    /** Set bold format the current selection */
    FormatBold = "KeyBinding.toggleBoldInComposer",
    /** Set italics format the current selection */
    FormatItalics = "KeyBinding.toggleItalicsInComposer",
    /** Insert link for current selection */
    FormatLink = "KeyBinding.FormatLink",
    /** Set code format for current selection */
    FormatCode = "KeyBinding.FormatCode",
    /** Format the current selection as quote */
    FormatQuote = "KeyBinding.toggleQuoteInComposer",
    /** Undo the last editing */
    EditUndo = "KeyBinding.editUndoInComposer",
    /** Redo editing */
    EditRedo = "KeyBinding.editRedoInComposer",
    /** Insert new line */
    NewLine = "KeyBinding.newLineInComposer",
    /** Move the cursor to the start of the message */
    MoveCursorToStart = "KeyBinding.jumpToStartInComposer",
    /** Move the cursor to the end of the message */
    MoveCursorToEnd = "KeyBinding.jumpToEndInComposer",

    /** Accepts chosen autocomplete selection */
    CompleteAutocomplete = "KeyBinding.completeAutocomplete",
    /** Accepts chosen autocomplete selection or,
     * if the autocompletion window is not shown, open the window and select the first selection */
    ForceCompleteAutocomplete = "KeyBinding.forceCompleteAutocomplete",
    /** Move to the previous autocomplete selection */
    PrevSelectionInAutocomplete = "KeyBinding.previousOptionInAutoComplete",
    /** Move to the next autocomplete selection */
    NextSelectionInAutocomplete = "KeyBinding.nextOptionInAutoComplete",
    /** Close the autocompletion window */
    CancelAutocomplete = "KeyBinding.cancelAutoComplete",

    /** Clear room list filter field */
    ClearRoomFilter = "KeyBinding.clearRoomFilter",
    /** Navigate up/down in the room list */
    PrevRoom = "KeyBinding.downerRoom",
    /** Navigate down in the room list */
    NextRoom = "KeyBinding.upperRoom",
    /** Select room from the room list */
    SelectRoomInRoomList = "KeyBinding.selectRoomInRoomList",
    /** Collapse room list section */
    CollapseRoomListSection = "KeyBinding.collapseSectionInRoomList",
    /** Expand room list section, if already expanded, jump to first room in the selection */
    ExpandRoomListSection = "KeyBinding.expandSectionInRoomList",

    /** Scroll up in the timeline */
    ScrollUp = "KeyBinding.scrollUpInTimeline",
    /** Scroll down in the timeline */
    ScrollDown = "KeyBinding.scrollDownInTimeline",
    /** Dismiss read marker and jump to bottom */
    DismissReadMarker = "KeyBinding.dismissReadMarkerAndJumpToBottom",
    /** Jump to oldest unread message */
    JumpToOldestUnread = "KeyBinding.jumpToOldestUnreadMessage",
    /** Upload a file */
    UploadFile = "KeyBinding.uploadFileToRoom",
    /** Focus search message in a room (must be enabled) */
    SearchInRoom = "KeyBinding.searchInRoom",
    /** Jump to the first (downloaded) message in the room */
    JumpToFirstMessage = "KeyBinding.jumpToFirstMessageInTimeline",
    /** Jump to the latest message in the room */
    JumpToLatestMessage = "KeyBinding.jumpToLastMessageInTimeline",

    /** Jump to room search (search for a room) */
    FilterRooms = "KeyBinding.filterRooms",
    /** Toggle the space panel */
    ToggleSpacePanel = "KeyBinding.toggleSpacePanel",
    /** Toggle the room side panel */
    ToggleRoomSidePanel = "KeyBinding.toggleRightPanel",
    /** Toggle the user menu */
    ToggleUserMenu = "KeyBinding.toggleTopLeftMenu",
    /** Toggle the short cut help dialog */
    ShowKeyboardSettings = "KeyBinding.showKeyBindingsSettings",
    /** Got to the Element home screen */
    GoToHome = "KeyBinding.goToHomeView",
    /** Select prev room */
    SelectPrevRoom = "KeyBinding.previousRoom",
    /** Select next room */
    SelectNextRoom = "KeyBinding.nextRoom",
    /** Select prev room with unread messages */
    SelectPrevUnreadRoom = "KeyBinding.previousUnreadRoom",
    /** Select next room with unread messages */
    SelectNextUnreadRoom = "KeyBinding.nextUnreadRoom",

    /** Switches to a space by number */
    SwitchToSpaceByNumber = "KeyBinding.switchToSpaceByNumber",
    /** Opens user settings */
    OpenUserSettings = "KeyBinding.openUserSettings",
    /** Navigates backward */
    PreviousVisitedRoomOrSpace = "KeyBinding.PreviousVisitedRoomOrSpace",
    /** Navigates forward */
    NextVisitedRoomOrSpace = "KeyBinding.NextVisitedRoomOrSpace",
    /** Navigates to the next Landmark */
    NextLandmark = "KeyBinding.nextLandmark",
    /** Navigates to the next Landmark */
    PreviousLandmark = "KeyBinding.previousLandmark",

    /** Toggles microphone while on a call */
    ToggleMicInCall = "KeyBinding.toggleMicInCall",
    /** Toggles webcam while on a call */
    ToggleWebcamInCall = "KeyBinding.toggleWebcamInCall",

    /** Accessibility actions */
    Escape = "KeyBinding.escape",
    Enter = "KeyBinding.enter",
    Space = "KeyBinding.space",
    Backspace = "KeyBinding.backspace",
    Delete = "KeyBinding.delete",
    Home = "KeyBinding.home",
    End = "KeyBinding.end",
    ArrowLeft = "KeyBinding.arrowLeft",
    ArrowUp = "KeyBinding.arrowUp",
    ArrowRight = "KeyBinding.arrowRight",
    ArrowDown = "KeyBinding.arrowDown",
    Tab = "KeyBinding.tab",
    Comma = "KeyBinding.comma",

    /** Toggle visibility of hidden events */
    ToggleHiddenEventVisibility = "KeyBinding.toggleHiddenEventVisibility",
}

export type KeyboardShortcutSetting = Omit<IBaseSetting<KeyCombo>, "supportedLevels" | "displayName"> & {
    displayName?: TranslationKey;
};

// TODO: We should figure out what to do with the keyboard shortcuts that are not handled by KeybindingManager
export type IKeyboardShortcuts = Partial<Record<KeyBindingAction, KeyboardShortcutSetting>>;

export interface ICategory {
    categoryLabel?: TranslationKey;
    // TODO: We should figure out what to do with the keyboard shortcuts that are not handled by KeybindingManager
    settingNames: KeyBindingAction[];
}

export enum CategoryName {
    NAVIGATION = "Navigation",
    ACCESSIBILITY = "Accessibility",
    CALLS = "Calls",
    COMPOSER = "Composer",
    ROOM_LIST = "Room List",
    ROOM = "Room",
    AUTOCOMPLETE = "Autocomplete",
    LABS = "Labs",
}

// Meta-key representing the digits [0-9] often found at the top of standard keyboard layouts
export const DIGITS = "digits";

export const ALTERNATE_KEY_NAME: Record<string, TranslationKey> = {
    [Key.PAGE_UP]: _td("keyboard|page_up"),
    [Key.PAGE_DOWN]: _td("keyboard|page_down"),
    [Key.ESCAPE]: _td("keyboard|escape"),
    [Key.ENTER]: _td("keyboard|enter"),
    [Key.SPACE]: _td("keyboard|space"),
    [Key.HOME]: _td("keyboard|home"),
    [Key.END]: _td("keyboard|end"),
    [Key.ALT]: _td("keyboard|alt"),
    [Key.CONTROL]: _td("keyboard|control"),
    [Key.SHIFT]: _td("keyboard|shift"),
    [DIGITS]: _td("keyboard|number"),
};
export const KEY_ICON: Record<string, string> = {
    [Key.ARROW_UP]: "↑",
    [Key.ARROW_DOWN]: "↓",
    [Key.ARROW_LEFT]: "←",
    [Key.ARROW_RIGHT]: "→",
};
if (IS_MAC) {
    KEY_ICON[Key.META] = "⌘";
    KEY_ICON[Key.ALT] = "⌥";
    KEY_ICON[Key.SHIFT] = "⇧";
}

export const CATEGORIES: Record<CategoryName, ICategory> = {
    [CategoryName.COMPOSER]: {
        categoryLabel: _td("settings|preferences|composer_heading"),
        settingNames: [
            KeyBindingAction.SendMessage,
            KeyBindingAction.NewLine,
            KeyBindingAction.FormatBold,
            KeyBindingAction.FormatItalics,
            KeyBindingAction.FormatQuote,
            KeyBindingAction.FormatLink,
            KeyBindingAction.FormatCode,
            KeyBindingAction.EditUndo,
            KeyBindingAction.EditRedo,
            KeyBindingAction.MoveCursorToStart,
            KeyBindingAction.MoveCursorToEnd,
            KeyBindingAction.CancelReplyOrEdit,
            KeyBindingAction.EditNextMessage,
            KeyBindingAction.EditPrevMessage,
            KeyBindingAction.SelectNextSendHistory,
            KeyBindingAction.SelectPrevSendHistory,
            KeyBindingAction.ShowStickerPicker,
        ],
    },
    [CategoryName.CALLS]: {
        categoryLabel: _td("keyboard|category_calls"),
        settingNames: [KeyBindingAction.ToggleMicInCall, KeyBindingAction.ToggleWebcamInCall],
    },
    [CategoryName.ROOM]: {
        categoryLabel: _td("common|room"),
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
    },
    [CategoryName.ROOM_LIST]: {
        categoryLabel: _td("keyboard|category_room_list"),
        settingNames: [
            KeyBindingAction.SelectRoomInRoomList,
            KeyBindingAction.ClearRoomFilter,
            KeyBindingAction.CollapseRoomListSection,
            KeyBindingAction.ExpandRoomListSection,
            KeyBindingAction.NextRoom,
            KeyBindingAction.PrevRoom,
        ],
    },
    [CategoryName.ACCESSIBILITY]: {
        categoryLabel: _td("common|accessibility"),
        settingNames: [
            KeyBindingAction.Escape,
            KeyBindingAction.Enter,
            KeyBindingAction.Space,
            KeyBindingAction.Backspace,
            KeyBindingAction.Delete,
            KeyBindingAction.Home,
            KeyBindingAction.End,
            KeyBindingAction.ArrowLeft,
            KeyBindingAction.ArrowUp,
            KeyBindingAction.ArrowRight,
            KeyBindingAction.ArrowDown,
            KeyBindingAction.Comma,
        ],
    },
    [CategoryName.NAVIGATION]: {
        categoryLabel: _td("keyboard|category_navigation"),
        settingNames: [
            KeyBindingAction.ToggleUserMenu,
            KeyBindingAction.ToggleRoomSidePanel,
            KeyBindingAction.ToggleSpacePanel,
            KeyBindingAction.ShowKeyboardSettings,
            KeyBindingAction.GoToHome,
            KeyBindingAction.FilterRooms,
            KeyBindingAction.SelectNextUnreadRoom,
            KeyBindingAction.SelectPrevUnreadRoom,
            KeyBindingAction.SelectNextRoom,
            KeyBindingAction.SelectPrevRoom,
            KeyBindingAction.OpenUserSettings,
            KeyBindingAction.SwitchToSpaceByNumber,
            KeyBindingAction.PreviousVisitedRoomOrSpace,
            KeyBindingAction.NextVisitedRoomOrSpace,
            KeyBindingAction.NextLandmark,
            KeyBindingAction.PreviousLandmark,
        ],
    },
    [CategoryName.AUTOCOMPLETE]: {
        categoryLabel: _td("keyboard|category_autocomplete"),
        settingNames: [
            KeyBindingAction.CancelAutocomplete,
            KeyBindingAction.NextSelectionInAutocomplete,
            KeyBindingAction.PrevSelectionInAutocomplete,
            KeyBindingAction.CompleteAutocomplete,
            KeyBindingAction.ForceCompleteAutocomplete,
        ],
    },
    [CategoryName.LABS]: {
        categoryLabel: _td("common|labs"),
        settingNames: [KeyBindingAction.ToggleHiddenEventVisibility],
    },
};

export const DESKTOP_SHORTCUTS = [
    KeyBindingAction.OpenUserSettings,
    KeyBindingAction.SwitchToSpaceByNumber,
    KeyBindingAction.PreviousVisitedRoomOrSpace,
    KeyBindingAction.NextVisitedRoomOrSpace,
];

export const MAC_ONLY_SHORTCUTS = [KeyBindingAction.OpenUserSettings];

// This is very intentionally modelled after SETTINGS as it will make it easier
// to implement customizable keyboard shortcuts
// TODO: TravisR will fix this nightmare when the new version of the SettingsStore becomes a thing
// XXX: Exported for tests
export const KEYBOARD_SHORTCUTS: IKeyboardShortcuts = {
    [KeyBindingAction.FormatBold]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.B,
        },
        displayName: _td("keyboard|composer_toggle_bold"),
    },
    [KeyBindingAction.FormatItalics]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.I,
        },
        displayName: _td("keyboard|composer_toggle_italics"),
    },
    [KeyBindingAction.FormatQuote]: {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.GREATER_THAN,
        },
        displayName: _td("keyboard|composer_toggle_quote"),
    },
    [KeyBindingAction.FormatCode]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.E,
        },
        displayName: _td("keyboard|composer_toggle_code_block"),
    },
    [KeyBindingAction.FormatLink]: {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.L,
        },
        displayName: _td("keyboard|composer_toggle_link"),
    },
    [KeyBindingAction.CancelReplyOrEdit]: {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("keyboard|cancel_reply"),
    },
    [KeyBindingAction.EditNextMessage]: {
        default: {
            key: Key.ARROW_DOWN,
        },
        displayName: _td("keyboard|navigate_next_message_edit"),
    },
    [KeyBindingAction.EditPrevMessage]: {
        default: {
            key: Key.ARROW_UP,
        },
        displayName: _td("keyboard|navigate_prev_message_edit"),
    },
    [KeyBindingAction.MoveCursorToStart]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.HOME,
        },
        displayName: _td("keyboard|composer_jump_start"),
    },
    [KeyBindingAction.MoveCursorToEnd]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.END,
        },
        displayName: _td("keyboard|composer_jump_end"),
    },
    [KeyBindingAction.SelectNextSendHistory]: {
        default: {
            altKey: true,
            ctrlKey: true,
            key: Key.ARROW_DOWN,
        },
        displayName: _td("keyboard|composer_navigate_next_history"),
    },
    [KeyBindingAction.SelectPrevSendHistory]: {
        default: {
            altKey: true,
            ctrlKey: true,
            key: Key.ARROW_UP,
        },
        displayName: _td("keyboard|composer_navigate_prev_history"),
    },
    [KeyBindingAction.ShowStickerPicker]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.SEMICOLON,
        },
        displayName: _td("keyboard|send_sticker"),
    },
    [KeyBindingAction.ToggleMicInCall]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.D,
        },
        displayName: _td("keyboard|toggle_microphone_mute"),
    },
    [KeyBindingAction.ToggleWebcamInCall]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.E,
        },
        displayName: _td("keyboard|toggle_webcam_mute"),
    },
    [KeyBindingAction.DismissReadMarker]: {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("keyboard|dismiss_read_marker_and_jump_bottom"),
    },
    [KeyBindingAction.JumpToOldestUnread]: {
        default: {
            shiftKey: true,
            key: Key.PAGE_UP,
        },
        displayName: _td("keyboard|jump_to_read_marker"),
    },
    [KeyBindingAction.UploadFile]: {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.U,
        },
        displayName: _td("keyboard|upload_file"),
    },
    [KeyBindingAction.ScrollUp]: {
        default: {
            key: Key.PAGE_UP,
        },
        displayName: _td("keyboard|scroll_up_timeline"),
    },
    [KeyBindingAction.ScrollDown]: {
        default: {
            key: Key.PAGE_DOWN,
        },
        displayName: _td("keyboard|scroll_down_timeline"),
    },
    [KeyBindingAction.FilterRooms]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.K,
        },
        displayName: _td("keyboard|jump_room_search"),
    },
    [KeyBindingAction.SelectRoomInRoomList]: {
        default: {
            key: Key.ENTER,
        },
        displayName: _td("keyboard|room_list_select_room"),
    },
    [KeyBindingAction.CollapseRoomListSection]: {
        default: {
            key: Key.ARROW_LEFT,
        },
        displayName: _td("keyboard|room_list_collapse_section"),
    },
    [KeyBindingAction.ExpandRoomListSection]: {
        default: {
            key: Key.ARROW_RIGHT,
        },
        displayName: _td("keyboard|room_list_expand_section"),
    },
    [KeyBindingAction.NextRoom]: {
        default: {
            key: Key.ARROW_DOWN,
        },
        displayName: _td("keyboard|room_list_navigate_down"),
    },
    [KeyBindingAction.PrevRoom]: {
        default: {
            key: Key.ARROW_UP,
        },
        displayName: _td("keyboard|room_list_navigate_up"),
    },
    [KeyBindingAction.ToggleUserMenu]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.BACKTICK,
        },
        displayName: _td("keyboard|toggle_top_left_menu"),
    },
    [KeyBindingAction.ToggleRoomSidePanel]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.PERIOD,
        },
        displayName: _td("keyboard|toggle_right_panel"),
    },
    [KeyBindingAction.ShowKeyboardSettings]: {
        default: {
            ctrlOrCmdKey: true,
            key: Key.SLASH,
        },
        displayName: _td("keyboard|keyboard_shortcuts_tab"),
    },
    [KeyBindingAction.GoToHome]: {
        default: {
            ctrlKey: true,
            altKey: !IS_MAC,
            shiftKey: IS_MAC,
            key: Key.H,
        },
        displayName: _td("keyboard|go_home_view"),
    },
    [KeyBindingAction.SelectNextUnreadRoom]: {
        default: {
            shiftKey: true,
            altKey: true,
            key: Key.ARROW_DOWN,
        },
        displayName: _td("keyboard|next_unread_room"),
    },
    [KeyBindingAction.SelectPrevUnreadRoom]: {
        default: {
            shiftKey: true,
            altKey: true,
            key: Key.ARROW_UP,
        },
        displayName: _td("keyboard|prev_unread_room"),
    },
    [KeyBindingAction.SelectNextRoom]: {
        default: {
            altKey: true,
            key: Key.ARROW_DOWN,
        },
        displayName: _td("keyboard|next_room"),
    },
    [KeyBindingAction.SelectPrevRoom]: {
        default: {
            altKey: true,
            key: Key.ARROW_UP,
        },
        displayName: _td("keyboard|prev_room"),
    },
    [KeyBindingAction.CancelAutocomplete]: {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("keyboard|autocomplete_cancel"),
    },
    [KeyBindingAction.NextSelectionInAutocomplete]: {
        default: {
            key: Key.ARROW_DOWN,
        },
        displayName: _td("keyboard|autocomplete_navigate_next"),
    },
    [KeyBindingAction.PrevSelectionInAutocomplete]: {
        default: {
            key: Key.ARROW_UP,
        },
        displayName: _td("keyboard|autocomplete_navigate_prev"),
    },
    [KeyBindingAction.ToggleSpacePanel]: {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.D,
        },
        displayName: _td("keyboard|toggle_space_panel"),
    },
    [KeyBindingAction.ToggleHiddenEventVisibility]: {
        default: {
            ctrlOrCmdKey: true,
            shiftKey: true,
            key: Key.H,
        },
        displayName: _td("keyboard|toggle_hidden_events"),
    },
    [KeyBindingAction.JumpToFirstMessage]: {
        default: {
            key: Key.HOME,
            ctrlKey: true,
        },
        displayName: _td("keyboard|jump_first_message"),
    },
    [KeyBindingAction.JumpToLatestMessage]: {
        default: {
            key: Key.END,
            ctrlKey: true,
        },
        displayName: _td("keyboard|jump_last_message"),
    },
    [KeyBindingAction.EditUndo]: {
        default: {
            key: Key.Z,
            ctrlOrCmdKey: true,
        },
        displayName: _td("keyboard|composer_undo"),
    },
    [KeyBindingAction.EditRedo]: {
        default: {
            key: IS_MAC ? Key.Z : Key.Y,
            ctrlOrCmdKey: true,
            shiftKey: IS_MAC,
        },
        displayName: _td("keyboard|composer_redo"),
    },
    [KeyBindingAction.PreviousVisitedRoomOrSpace]: {
        default: {
            metaKey: IS_MAC,
            altKey: !IS_MAC,
            key: IS_MAC ? Key.SQUARE_BRACKET_LEFT : Key.ARROW_LEFT,
        },
        displayName: _td("keyboard|navigate_prev_history"),
    },
    [KeyBindingAction.NextVisitedRoomOrSpace]: {
        default: {
            metaKey: IS_MAC,
            altKey: !IS_MAC,
            key: IS_MAC ? Key.SQUARE_BRACKET_RIGHT : Key.ARROW_RIGHT,
        },
        displayName: _td("keyboard|navigate_next_history"),
    },
    [KeyBindingAction.SwitchToSpaceByNumber]: {
        default: {
            ctrlOrCmdKey: true,
            key: DIGITS,
        },
        displayName: _td("keyboard|switch_to_space"),
    },
    [KeyBindingAction.OpenUserSettings]: {
        default: {
            metaKey: true,
            key: Key.COMMA,
        },
        displayName: _td("keyboard|open_user_settings"),
    },
    [KeyBindingAction.Escape]: {
        default: {
            key: Key.ESCAPE,
        },
        displayName: _td("keyboard|close_dialog_menu"),
    },
    [KeyBindingAction.Enter]: {
        default: {
            key: Key.ENTER,
        },
        displayName: _td("keyboard|activate_button"),
    },
    [KeyBindingAction.Space]: {
        default: {
            key: Key.SPACE,
        },
    },
    [KeyBindingAction.Backspace]: {
        default: {
            key: Key.BACKSPACE,
        },
    },
    [KeyBindingAction.Delete]: {
        default: {
            key: Key.DELETE,
        },
    },
    [KeyBindingAction.Home]: {
        default: {
            key: Key.HOME,
        },
    },
    [KeyBindingAction.End]: {
        default: {
            key: Key.END,
        },
    },
    [KeyBindingAction.ArrowLeft]: {
        default: {
            key: Key.ARROW_LEFT,
        },
    },
    [KeyBindingAction.ArrowUp]: {
        default: {
            key: Key.ARROW_UP,
        },
    },
    [KeyBindingAction.ArrowRight]: {
        default: {
            key: Key.ARROW_RIGHT,
        },
    },
    [KeyBindingAction.ArrowDown]: {
        default: {
            key: Key.ARROW_DOWN,
        },
    },
    [KeyBindingAction.Comma]: {
        default: {
            key: Key.COMMA,
        },
    },
    [KeyBindingAction.NextLandmark]: {
        default: {
            ctrlOrCmdKey: !IS_ELECTRON,
            key: Key.F6,
        },
        displayName: _td("keyboard|next_landmark"),
    },
    [KeyBindingAction.PreviousLandmark]: {
        default: {
            ctrlOrCmdKey: !IS_ELECTRON,
            key: Key.F6,
            shiftKey: true,
        },
        displayName: _td("keyboard|prev_landmark"),
    },
};
