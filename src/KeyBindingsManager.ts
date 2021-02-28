import { isMac, Key } from './Keyboard';
import SettingsStore from './settings/SettingsStore';

export enum KeyBindingContext {
    /** Key bindings for the chat message composer component */
    MessageComposer = 'MessageComposer',
    /** Key bindings for text editing autocompletion */
    AutoComplete = 'AutoComplete',
}

export enum KeyAction {
    None = 'None',

    // SendMessageComposer actions:

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

    // Autocomplete

    /** Apply the current autocomplete selection */
    AutocompleteApply = 'AutocompleteApply',
    /** Cancel autocompletion */
    AutocompleteCancel = 'AutocompleteCancel',
    /** Move to the previous autocomplete selection */
    AutocompletePrevSelection = 'AutocompletePrevSelection',
    /** Move to the next autocomplete selection */
    AutocompleteNextSelection = 'AutocompleteNextSelection',
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

export type KeyBinding = {
    action: KeyAction;
    keyCombo: KeyCombo;
}

const messageComposerBindings = (): KeyBinding[] => {
    const bindings: KeyBinding[] = [
        {
            action: KeyAction.SelectPrevSendHistory,
            keyCombo: {
                key: Key.ARROW_UP,
                altKey: true,
                ctrlKey: true,
            },
        },
        {
            action: KeyAction.SelectNextSendHistory,
            keyCombo: {
                key: Key.ARROW_DOWN,
                altKey: true,
                ctrlKey: true,
            },
        },
        {
            action: KeyAction.EditPrevMessage,
            keyCombo: {
                key: Key.ARROW_UP,
            },
        },
        {
            action: KeyAction.EditNextMessage,
            keyCombo: {
                key: Key.ARROW_DOWN,
            },
        },
        {
            action: KeyAction.CancelEditing,
            keyCombo: {
                key: Key.ESCAPE,
            },
        },
        {
            action: KeyAction.FormatBold,
            keyCombo: {
                key: Key.B,
                ctrlOrCmd: true,
            },
        },
        {
            action: KeyAction.FormatItalics,
            keyCombo: {
                key: Key.I,
                ctrlOrCmd: true,
            },
        },
        {
            action: KeyAction.FormatQuote,
            keyCombo: {
                key: Key.GREATER_THAN,
                ctrlOrCmd: true,
                shiftKey: true,
            },
        },
        {
            action: KeyAction.EditUndo,
            keyCombo: {
                key: Key.Z,
                ctrlOrCmd: true,
            },
        },
        // Note: the following two bindings also work with just HOME and END, add them here?
        {
            action: KeyAction.MoveCursorToStart,
            keyCombo: {
                key: Key.HOME,
                ctrlOrCmd: true,
            },
        },
        {
            action: KeyAction.MoveCursorToEnd,
            keyCombo: {
                key: Key.END,
                ctrlOrCmd: true,
            },
        },
    ];
    if (isMac) {
        bindings.push({
            action: KeyAction.EditRedo,
            keyCombo: {
                key: Key.Z,
                ctrlOrCmd: true,
                shiftKey: true,
            },
        });
    } else {
        bindings.push({
            action: KeyAction.EditRedo,
            keyCombo: {
                key: Key.Y,
                ctrlOrCmd: true,
            },
        });
    }
    if (SettingsStore.getValue('MessageComposerInput.ctrlEnterToSend')) {
        bindings.push({
            action: KeyAction.Send,
            keyCombo: {
                key: Key.ENTER,
                ctrlOrCmd: true,
            },
        });
        bindings.push({
            action: KeyAction.NewLine,
            keyCombo: {
                key: Key.ENTER,
            },
        });
    } else {
        bindings.push({
            action: KeyAction.Send,
            keyCombo: {
                key: Key.ENTER,
            },
        });
        bindings.push({
            action: KeyAction.NewLine,
            keyCombo: {
                key: Key.ENTER,
                shiftKey: true,
            },
        });
        if (isMac) {
            bindings.push({
                action: KeyAction.NewLine,
                keyCombo: {
                    key: Key.ENTER,
                    altKey: true,
                },
            });
        }
    }
    return bindings;
}

const autocompleteBindings = (): KeyBinding[] => {
    return [
        {
            action: KeyAction.AutocompleteApply,
            keyCombo: {
                key: Key.TAB,
            },
        },
        {
            action: KeyAction.AutocompleteApply,
            keyCombo: {
                key: Key.TAB,
                ctrlKey: true,
            },
        },
        {
            action: KeyAction.AutocompleteApply,
            keyCombo: {
                key: Key.TAB,
                shiftKey: true,
            },
        },
        {
            action: KeyAction.AutocompleteCancel,
            keyCombo: {
                key: Key.ESCAPE,
            },
        },
        {
            action: KeyAction.AutocompletePrevSelection,
            keyCombo: {
                key: Key.ARROW_UP,
            },
        },
        {
            action: KeyAction.AutocompleteNextSelection,
            keyCombo: {
                key: Key.ARROW_DOWN,
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

export type KeyBindingsGetter = () => KeyBinding[];

export class KeyBindingsManager {
    /**
     * Map of KeyBindingContext to a KeyBinding getter arrow function.
     *
     * Returning a getter function allowed to have dynamic bindings, e.g. when settings change the bindings can be
     * recalculated.
     */
    contextBindings: Record<KeyBindingContext, KeyBindingsGetter> = {
        [KeyBindingContext.MessageComposer]: messageComposerBindings,
        [KeyBindingContext.AutoComplete]: autocompleteBindings,
    };

    /**
     * Finds a matching KeyAction for a given KeyboardEvent
     */
    getAction(context: KeyBindingContext, ev: KeyboardEvent | React.KeyboardEvent): KeyAction {
        const bindings = this.contextBindings[context]?.();
        if (!bindings) {
            return KeyAction.None;
        }
        const binding = bindings.find(it => isKeyComboMatch(ev, it.keyCombo, isMac));
        if (binding) {
            return binding.action;
        }

        return KeyAction.None;
    }
}

const manager = new KeyBindingsManager();

export function getKeyBindingsManager(): KeyBindingsManager {
    return manager;
}
