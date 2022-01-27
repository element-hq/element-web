/*
Copyright 2021 Clemens Zeidler

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

import { defaultBindingsProvider } from './KeyBindingsDefaults';
import { isMac } from './Keyboard';

/** Actions for the chat message composer component */
export enum MessageComposerAction {
    /** Send a message */
    Send = 'KeyBinding.sendMessageInComposer',
    /** Go backwards through the send history and use the message in composer view */
    SelectPrevSendHistory = 'KeyBinding.previousMessageInComposerHistory',
    /** Go forwards through the send history */
    SelectNextSendHistory = 'KeyBinding.nextMessageInComposerHistory',
    /** Start editing the user's last sent message */
    EditPrevMessage = 'KeyBinding.editPreviousMessage',
    /** Start editing the user's next sent message */
    EditNextMessage = 'KeyBinding.editNextMessage',
    /** Cancel editing a message or cancel replying to a message */
    CancelEditing = 'KeyBinding.cancelReplyInComposer',

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
}

/** Actions for text editing autocompletion */
export enum AutocompleteAction {
    /** Accepts chosen autocomplete selection */
    Complete = 'KeyBinding.completeAutocomplete',
    /** Accepts chosen autocomplete selection or,
     * if the autocompletion window is not shown, open the window and select the first selection */
    ForceComplete = 'KeyBinding.forceCompleteAutocomplete',
    /** Move to the previous autocomplete selection */
    PrevSelection = 'KeyBinding.previousOptionInAutoComplete',
    /** Move to the next autocomplete selection */
    NextSelection = 'KeyBinding.nextOptionInAutoComplete',
    /** Close the autocompletion window */
    Cancel = 'KeyBinding.cancelAutoComplete',
}

/** Actions for the room list sidebar */
export enum RoomListAction {
    /** Clear room list filter field */
    ClearSearch = 'KeyBinding.clearRoomFilter',
    /** Navigate up/down in the room list */
    PrevRoom = 'KeyBinding.downerRoom',
    /** Navigate down in the room list */
    NextRoom = 'KeyBinding.upperRoom',
    /** Select room from the room list */
    SelectRoom = 'KeyBinding.selectRoomInRoomList',
    /** Collapse room list section */
    CollapseSection = 'KeyBinding.collapseSectionInRoomList',
    /** Expand room list section, if already expanded, jump to first room in the selection */
    ExpandSection = 'KeyBinding.expandSectionInRoomList',
}

/** Actions for the current room view */
export enum RoomAction {
    /** Scroll up in the timeline */
    ScrollUp = 'KeyBinding.scrollUpInTimeline',
    /** Scroll down in the timeline */
    RoomScrollDown = 'KeyBinding.scrollDownInTimeline',
    /** Dismiss read marker and jump to bottom */
    DismissReadMarker = 'KeyBinding.dismissReadMarkerAndJumpToBottom',
    /** Jump to oldest unread message */
    JumpToOldestUnread = 'KeyBinding.jumpToOldestUnreadMessage',
    /** Upload a file */
    UploadFile = 'KeyBinding.uploadFileToRoom',
    /** Focus search message in a room (must be enabled) */
    FocusSearch = 'KeyBinding.searchInRoom',
    /** Jump to the first (downloaded) message in the room */
    JumpToFirstMessage = 'KeyBinding.jumpToFirstMessageInTimeline',
    /** Jump to the latest message in the room */
    JumpToLatestMessage = 'KeyBinding.jumpToLastMessageInTimeline',
}

/** Actions for navigating do various menus, dialogs or screens */
export enum NavigationAction {
    /** Jump to room search (search for a room) */
    FocusRoomSearch = 'KeyBinding.filterRooms',
    /** Toggle the space panel */
    ToggleSpacePanel = 'KeyBinding.toggleSpacePanel',
    /** Toggle the room side panel */
    ToggleRoomSidePanel = 'KeyBinding.toggleRightPanel',
    /** Toggle the user menu */
    ToggleUserMenu = 'KeyBinding.toggleTopLeftMenu',
    /** Toggle the short cut help dialog */
    OpenShortCutDialog = 'KeyBinding.showKeyBindingsSettings',
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
}

/** Actions only available when labs are enabled */
export enum LabsAction {
    /** Toggle visibility of hidden events */
    ToggleHiddenEventVisibility = 'KeyBinding.toggleHiddenEventVisibility',
}

export type KeyBindingAction = (
    MessageComposerAction | AutocompleteAction | RoomListAction | RoomAction | NavigationAction | LabsAction
);

/**
 * Represent a key combination.
 *
 * The combo is evaluated strictly, i.e. the KeyboardEvent must match exactly what is specified in the KeyCombo.
 */
export type KeyCombo = {
    key?: string;

    /** On PC: ctrl is pressed; on Mac: meta is pressed */
    ctrlOrCmd?: boolean;

    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
};

export type KeyBinding<T extends string> = {
    action: T;
    keyCombo: KeyCombo;
};

/**
 * Helper method to check if a KeyboardEvent matches a KeyCombo
 *
 * Note, this method is only exported for testing.
 */
export function isKeyComboMatch(ev: KeyboardEvent | React.KeyboardEvent, combo: KeyCombo, onMac: boolean): boolean {
    if (combo.key !== undefined) {
        // When shift is pressed, letters are returned as upper case chars. In this case do a lower case comparison.
        // This works for letter combos such as shift + U as well for none letter combos such as shift + Escape.
        // If shift is not pressed, the toLowerCase conversion can be avoided.
        if (ev.shiftKey) {
            if (ev.key.toLowerCase() !== combo.key.toLowerCase()) {
                return false;
            }
        } else if (ev.key !== combo.key) {
            return false;
        }
    }

    const comboCtrl = combo.ctrlKey ?? false;
    const comboAlt = combo.altKey ?? false;
    const comboShift = combo.shiftKey ?? false;
    const comboMeta = combo.metaKey ?? false;
    // Tests mock events may keep the modifiers undefined; convert them to booleans
    const evCtrl = ev.ctrlKey ?? false;
    const evAlt = ev.altKey ?? false;
    const evShift = ev.shiftKey ?? false;
    const evMeta = ev.metaKey ?? false;
    // When ctrlOrCmd is set, the keys need do evaluated differently on PC and Mac
    if (combo.ctrlOrCmd) {
        if (onMac) {
            if (!evMeta
                || evCtrl !== comboCtrl
                || evAlt !== comboAlt
                || evShift !== comboShift) {
                return false;
            }
        } else {
            if (!evCtrl
                || evMeta !== comboMeta
                || evAlt !== comboAlt
                || evShift !== comboShift) {
                return false;
            }
        }
        return true;
    }

    if (evMeta !== comboMeta
        || evCtrl !== comboCtrl
        || evAlt !== comboAlt
        || evShift !== comboShift) {
        return false;
    }

    return true;
}

export type KeyBindingGetter<T extends string> = () => KeyBinding<T>[];

export interface IKeyBindingsProvider {
    getMessageComposerBindings: KeyBindingGetter<MessageComposerAction>;
    getAutocompleteBindings: KeyBindingGetter<AutocompleteAction>;
    getRoomListBindings: KeyBindingGetter<RoomListAction>;
    getRoomBindings: KeyBindingGetter<RoomAction>;
    getNavigationBindings: KeyBindingGetter<NavigationAction>;
    getLabsBindings: KeyBindingGetter<LabsAction>;
}

export class KeyBindingsManager {
    /**
     * List of key bindings providers.
     *
     * Key bindings from the first provider(s) in the list will have precedence over key bindings from later providers.
     *
     * To overwrite the default key bindings add a new providers before the default provider, e.g. a provider for
     * customized key bindings.
     */
    bindingsProviders: IKeyBindingsProvider[] = [
        defaultBindingsProvider,
    ];

    /**
     * Finds a matching KeyAction for a given KeyboardEvent
     */
    private getAction<T extends string>(
        getters: KeyBindingGetter<T>[],
        ev: KeyboardEvent | React.KeyboardEvent,
    ): T | undefined {
        for (const getter of getters) {
            const bindings = getter();
            const binding = bindings.find(it => isKeyComboMatch(ev, it.keyCombo, isMac));
            if (binding) {
                return binding.action;
            }
        }
        return undefined;
    }

    getMessageComposerAction(ev: KeyboardEvent | React.KeyboardEvent): MessageComposerAction | undefined {
        return this.getAction(this.bindingsProviders.map(it => it.getMessageComposerBindings), ev);
    }

    getAutocompleteAction(ev: KeyboardEvent | React.KeyboardEvent): AutocompleteAction | undefined {
        return this.getAction(this.bindingsProviders.map(it => it.getAutocompleteBindings), ev);
    }

    getRoomListAction(ev: KeyboardEvent | React.KeyboardEvent): RoomListAction | undefined {
        return this.getAction(this.bindingsProviders.map(it => it.getRoomListBindings), ev);
    }

    getRoomAction(ev: KeyboardEvent | React.KeyboardEvent): RoomAction | undefined {
        return this.getAction(this.bindingsProviders.map(it => it.getRoomBindings), ev);
    }

    getNavigationAction(ev: KeyboardEvent | React.KeyboardEvent): NavigationAction | undefined {
        return this.getAction(this.bindingsProviders.map(it => it.getNavigationBindings), ev);
    }

    getLabsAction(ev: KeyboardEvent | React.KeyboardEvent): LabsAction | undefined {
        return this.getAction(this.bindingsProviders.map(it => it.getLabsBindings), ev);
    }
}

const manager = new KeyBindingsManager();

export function getKeyBindingsManager(): KeyBindingsManager {
    return manager;
}
