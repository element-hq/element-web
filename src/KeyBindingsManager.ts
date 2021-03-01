import { isMac, Key } from './Keyboard';
import SettingsStore from './settings/SettingsStore';

/** Actions for the chat message composer component */
export enum MessageComposerAction {
    /** Send a message */
    Send = 'Send',
    /** Go backwards through the send history and use the message in composer view */
    SelectPrevSendHistory = 'SelectPrevSendHistory',
    /** Go forwards through the send history */
    SelectNextSendHistory = 'SelectNextSendHistory',
    /** Start editing the user's last sent message */
    EditPrevMessage = 'EditPrevMessage',
    /** Start editing the user's next sent message */
    EditNextMessage = 'EditNextMessage',
    /** Cancel editing a message or cancel replying to a message*/
    CancelEditing = 'CancelEditing',

    /** Set bold format the current selection */
    FormatBold = 'FormatBold',
    /** Set italics format the current selection */
    FormatItalics = 'FormatItalics',
    /** Format the current selection as quote */
    FormatQuote = 'FormatQuote',
    /** Undo the last editing */
    EditUndo = 'EditUndo',
    /** Redo editing */
    EditRedo = 'EditRedo',
    /** Insert new line */
    NewLine = 'NewLine',
    MoveCursorToStart = 'MoveCursorToStart',
    MoveCursorToEnd = 'MoveCursorToEnd',
}

/** Actions for text editing autocompletion */
export enum AutocompleteAction {
    /** Apply the current autocomplete selection */
    ApplySelection = 'ApplySelection',
    /** Cancel autocompletion */
    Cancel = 'Cancel',
    /** Move to the previous autocomplete selection */
    PrevSelection = 'PrevSelection',
    /** Move to the next autocomplete selection */
    NextSelection = 'NextSelection',
}

/** Actions for the left room list sidebar */
export enum RoomListAction {
    /** Clear room list filter field */
    ClearSearch = 'ClearSearch',
    /** Navigate up/down in the room list */
    PrevRoom = 'PrevRoom',
    /** Navigate down in the room list */
    NextRoom = 'NextRoom',
    /** Select room from the room list */
    SelectRoom = 'SelectRoom',
    /** Collapse room list section */
    CollapseSection = 'CollapseSection',
    /** Expand room list section, if already expanded, jump to first room in the selection */
    ExpandSection = 'ExpandSection',
}

/** Actions for the current room view */
export enum RoomAction {
    /** Jump to room search (search for a room)*/
    FocusRoomSearch = 'FocusRoomSearch', // TODO: move to NavigationAction?
    /** Scroll up in the timeline */
    ScrollUp = 'ScrollUp',
    /** Scroll down in the timeline */
    RoomScrollDown = 'RoomScrollDown',
    /** Dismiss read marker and jump to bottom */
    DismissReadMarker = 'DismissReadMarker',
    /** Jump to oldest unread message */
    JumpToOldestUnread = 'JumpToOldestUnread',
    /* Upload a file */
    UploadFile = 'UploadFile',
    /* Focus search message in a room (must be enabled) */
    FocusSearch = 'FocusSearch',
    /* Jump to the first (downloaded) message in the room */
    JumpToFirstMessage = 'JumpToFirstMessage',
    /* Jump to the latest message in the room */
    JumpToLatestMessage = 'JumpToLatestMessage',
}

/** Actions for navigating do various menus / dialogs / screens */
export enum NavigationAction {
    /** Toggle the room side panel */
    ToggleRoomSidePanel = 'ToggleRoomSidePanel',
    /** Toggle the user menu */
    ToggleUserMenu = 'ToggleUserMenu',
    /* Toggle the short cut help dialog */
    ToggleShortCutDialog = 'ToggleShortCutDialog',
    /* Got to the Element home screen */
    GoToHome = 'GoToHome',
    /* Select prev room */
    SelectPrevRoom = 'SelectPrevRoom',
    /* Select next room */
    SelectNextRoom = 'SelectNextRoom',
    /* Select prev room with unread messages*/
    SelectPrevUnreadRoom = 'SelectPrevUnreadRoom',
    /* Select next room with unread messages*/
    SelectNextUnreadRoom = 'SelectNextUnreadRoom',
}

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
}

export type KeyBinding<T extends string> = {
    action: T;
    keyCombo: KeyCombo;
}

const messageComposerBindings = (): KeyBinding<MessageComposerAction>[] => {
    const bindings: KeyBinding<MessageComposerAction>[] = [
        {
            action: MessageComposerAction.SelectPrevSendHistory,
            keyCombo: {
                key: Key.ARROW_UP,
                altKey: true,
                ctrlKey: true,
            },
        },
        {
            action: MessageComposerAction.SelectNextSendHistory,
            keyCombo: {
                key: Key.ARROW_DOWN,
                altKey: true,
                ctrlKey: true,
            },
        },
        {
            action: MessageComposerAction.EditPrevMessage,
            keyCombo: {
                key: Key.ARROW_UP,
            },
        },
        {
            action: MessageComposerAction.EditNextMessage,
            keyCombo: {
                key: Key.ARROW_DOWN,
            },
        },
        {
            action: MessageComposerAction.CancelEditing,
            keyCombo: {
                key: Key.ESCAPE,
            },
        },
        {
            action: MessageComposerAction.FormatBold,
            keyCombo: {
                key: Key.B,
                ctrlOrCmd: true,
            },
        },
        {
            action: MessageComposerAction.FormatItalics,
            keyCombo: {
                key: Key.I,
                ctrlOrCmd: true,
            },
        },
        {
            action: MessageComposerAction.FormatQuote,
            keyCombo: {
                key: Key.GREATER_THAN,
                ctrlOrCmd: true,
                shiftKey: true,
            },
        },
        {
            action: MessageComposerAction.EditUndo,
            keyCombo: {
                key: Key.Z,
                ctrlOrCmd: true,
            },
        },
        // Note: the following two bindings also work with just HOME and END, add them here?
        {
            action: MessageComposerAction.MoveCursorToStart,
            keyCombo: {
                key: Key.HOME,
                ctrlOrCmd: true,
            },
        },
        {
            action: MessageComposerAction.MoveCursorToEnd,
            keyCombo: {
                key: Key.END,
                ctrlOrCmd: true,
            },
        },
    ];
    if (isMac) {
        bindings.push({
            action: MessageComposerAction.EditRedo,
            keyCombo: {
                key: Key.Z,
                ctrlOrCmd: true,
                shiftKey: true,
            },
        });
    } else {
        bindings.push({
            action: MessageComposerAction.EditRedo,
            keyCombo: {
                key: Key.Y,
                ctrlOrCmd: true,
            },
        });
    }
    if (SettingsStore.getValue('MessageComposerInput.ctrlEnterToSend')) {
        bindings.push({
            action: MessageComposerAction.Send,
            keyCombo: {
                key: Key.ENTER,
                ctrlOrCmd: true,
            },
        });
        bindings.push({
            action: MessageComposerAction.NewLine,
            keyCombo: {
                key: Key.ENTER,
            },
        });
    } else {
        bindings.push({
            action: MessageComposerAction.Send,
            keyCombo: {
                key: Key.ENTER,
            },
        });
        bindings.push({
            action: MessageComposerAction.NewLine,
            keyCombo: {
                key: Key.ENTER,
                shiftKey: true,
            },
        });
        if (isMac) {
            bindings.push({
                action: MessageComposerAction.NewLine,
                keyCombo: {
                    key: Key.ENTER,
                    altKey: true,
                },
            });
        }
    }
    return bindings;
}

const autocompleteBindings = (): KeyBinding<AutocompleteAction>[] => {
    return [
        {
            action: AutocompleteAction.ApplySelection,
            keyCombo: {
                key: Key.TAB,
            },
        },
        {
            action: AutocompleteAction.ApplySelection,
            keyCombo: {
                key: Key.TAB,
                ctrlKey: true,
            },
        },
        {
            action: AutocompleteAction.ApplySelection,
            keyCombo: {
                key: Key.TAB,
                shiftKey: true,
            },
        },
        {
            action: AutocompleteAction.Cancel,
            keyCombo: {
                key: Key.ESCAPE,
            },
        },
        {
            action: AutocompleteAction.PrevSelection,
            keyCombo: {
                key: Key.ARROW_UP,
            },
        },
        {
            action: AutocompleteAction.NextSelection,
            keyCombo: {
                key: Key.ARROW_DOWN,
            },
        },
    ];
}

const roomListBindings = (): KeyBinding<RoomListAction>[] => {
    return [
        {
            action: RoomListAction.ClearSearch,
            keyCombo: {
                key: Key.ESCAPE,
            },
        },
        {
            action: RoomListAction.PrevRoom,
            keyCombo: {
                key: Key.ARROW_UP,
            },
        },
        {
            action: RoomListAction.NextRoom,
            keyCombo: {
                key: Key.ARROW_DOWN,
            },
        },
        {
            action: RoomListAction.SelectRoom,
            keyCombo: {
                key: Key.ENTER,
            },
        },
        {
            action: RoomListAction.CollapseSection,
            keyCombo: {
                key: Key.ARROW_LEFT,
            },
        },
        {
            action: RoomListAction.ExpandSection,
            keyCombo: {
                key: Key.ARROW_RIGHT,
            },
        },
    ];
}

const roomBindings = (): KeyBinding<RoomAction>[] => {
    const bindings = [
        {
            action: RoomAction.FocusRoomSearch,
            keyCombo: {
                key: Key.K,
                ctrlOrCmd: true,
            },
        },
        {
            action: RoomAction.ScrollUp,
            keyCombo: {
                key: Key.PAGE_UP,
            },
        },
        {
            action: RoomAction.RoomScrollDown,
            keyCombo: {
                key: Key.PAGE_DOWN,
            },
        },
        {
            action: RoomAction.DismissReadMarker,
            keyCombo: {
                key: Key.ESCAPE,
            },
        },
        {
            action: RoomAction.UploadFile,
            keyCombo: {
                key: Key.U,
                ctrlOrCmd: true,
                shiftKey: true,
            },
        },
        {
            action: RoomAction.JumpToFirstMessage,
            keyCombo: {
                key: Key.HOME,
                ctrlKey: true,
            },
        },
        {
            action: RoomAction.JumpToLatestMessage,
            keyCombo: {
                key: Key.END,
                ctrlKey: true,
            },
        },
    ];

    if (SettingsStore.getValue('ctrlFForSearch')) {
        bindings.push({
            action: RoomAction.FocusSearch,
            keyCombo: {
                key: Key.F,
                ctrlOrCmd: true,
            },
        });
    }

    return bindings;
}

const navigationBindings = (): KeyBinding<NavigationAction>[] => {
    return [
        {
            action: NavigationAction.ToggleRoomSidePanel,
            keyCombo: {
                key: Key.PERIOD,
                ctrlOrCmd: true,
            },
        },
        {
            action: NavigationAction.ToggleUserMenu,
            // Ideally this would be CTRL+P for "Profile", but that's
            // taken by the print dialog. CTRL+I for "Information"
            // was previously chosen but conflicted with italics in
            // composer, so CTRL+` it is
            keyCombo: {
                key: Key.BACKTICK,
                ctrlOrCmd: true,
            },
        },
        {
            action: NavigationAction.ToggleShortCutDialog,
            keyCombo: {
                key: Key.SLASH,
                ctrlOrCmd: true,
            },
        },
        {
            action: NavigationAction.ToggleShortCutDialog,
            keyCombo: {
                key: Key.SLASH,
                ctrlOrCmd: true,
                shiftKey: true,
            },
        },
        {
            action: NavigationAction.GoToHome,
            keyCombo: {
                key: Key.H,
                ctrlOrCmd: true,
                altKey: true,
            },
        },

        {
            action: NavigationAction.SelectPrevRoom,
            keyCombo: {
                key: Key.ARROW_UP,
                altKey: true,
            },
        },
        {
            action: NavigationAction.SelectNextRoom,
            keyCombo: {
                key: Key.ARROW_DOWN,
                altKey: true,
            },
        },
        {
            action: NavigationAction.SelectPrevUnreadRoom,
            keyCombo: {
                key: Key.ARROW_UP,
                altKey: true,
                shiftKey: true,
            },
        },
        {
            action: NavigationAction.SelectNextUnreadRoom,
            keyCombo: {
                key: Key.ARROW_DOWN,
                altKey: true,
                shiftKey: true,
            },
        },
    ]
}

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
    // When ctrlOrCmd is set, the keys need do evaluated differently on PC and Mac
    if (combo.ctrlOrCmd) {
        if (onMac) {
            if (!ev.metaKey
                || ev.ctrlKey !== comboCtrl
                || ev.altKey !== comboAlt
                || ev.shiftKey !== comboShift) {
                return false;
            }
        } else {
            if (!ev.ctrlKey
                || ev.metaKey !== comboMeta
                || ev.altKey !== comboAlt
                || ev.shiftKey !== comboShift) {
                return false;
            }
        }
        return true;
    }

    if (ev.metaKey !== comboMeta
        || ev.ctrlKey !== comboCtrl
        || ev.altKey !== comboAlt
        || ev.shiftKey !== comboShift) {
        return false;
    }

    return true;
}
export class KeyBindingsManager {
    /**
     * Finds a matching KeyAction for a given KeyboardEvent
     */
    private getAction<T extends string>(bindings: KeyBinding<T>[], ev: KeyboardEvent | React.KeyboardEvent)
        : T | undefined {
        const binding = bindings.find(it => isKeyComboMatch(ev, it.keyCombo, isMac));
        if (binding) {
            return binding.action;
        }
        return undefined;
    }

    getMessageComposerAction(ev: KeyboardEvent | React.KeyboardEvent): MessageComposerAction | undefined {
        const bindings = messageComposerBindings();
        return this.getAction(bindings, ev);
    }

    getAutocompleteAction(ev: KeyboardEvent | React.KeyboardEvent): AutocompleteAction | undefined {
        const bindings = autocompleteBindings();
        return this.getAction(bindings, ev);
    }

    getRoomListAction(ev: KeyboardEvent | React.KeyboardEvent): RoomListAction | undefined {
        const bindings = roomListBindings();
        return this.getAction(bindings, ev);
    }

    getRoomAction(ev: KeyboardEvent | React.KeyboardEvent): RoomAction | undefined {
        const bindings = roomBindings();
        return this.getAction(bindings, ev);
    }

    getNavigationAction(ev: KeyboardEvent | React.KeyboardEvent): NavigationAction | undefined {
        const bindings = navigationBindings();
        return this.getAction(bindings, ev);
    }
}

const manager = new KeyBindingsManager();

export function getKeyBindingsManager(): KeyBindingsManager {
    return manager;
}
