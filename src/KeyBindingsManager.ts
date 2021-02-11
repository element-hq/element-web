import { isMac } from "./Keyboard";

export enum KeyBindingContext {

}

export enum KeyAction {
    None = 'None',
}

/**
 * Represent a key combination.
 * 
 * The combo is evaluated strictly, i.e. the KeyboardEvent must match the exactly what is specified in the KeyCombo.
 */
export type KeyCombo = {
    /** Currently only one `normal` key is supported */
    keys: string[];

    /** On PC: ctrl is pressed; on Mac: meta is pressed */
    ctrlOrCmd?: boolean;

    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
}

export type KeyBinding = {
    keyCombo: KeyCombo;
    action: KeyAction;
}

/**
 * Helper method to check if a KeyboardEvent matches a KeyCombo
 * 
 * Note, this method is only exported for testing.
 */
export function isKeyComboMatch(ev: KeyboardEvent, combo: KeyCombo, onMac: boolean): boolean {
    if (combo.keys.length > 0 && ev.key !== combo.keys[0]) {
        return false;
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
    contextBindings: Record<KeyBindingContext, KeyBinding[]> = {};

    /**
     * Finds a matching KeyAction for a given KeyboardEvent
     */
    getAction(context: KeyBindingContext, ev: KeyboardEvent): KeyAction {
        const bindings = this.contextBindings[context];
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
