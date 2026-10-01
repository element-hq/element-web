/*
Copyright 2024 New Vector Ltd.
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2021 Clemens Zeidler

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type KeyBindingAction } from "./accessibility/KeyboardShortcuts";
import { defaultBindingsProvider } from "./KeyBindingsDefaults";
import { IS_MAC } from "./Keyboard";

/**
 * Represent a key combination.
 *
 * The combo is evaluated strictly, i.e. the KeyboardEvent must match exactly what is specified in the KeyCombo.
 */
export type KeyCombo = {
    key: string;

    /** On PC: ctrl is pressed; on Mac: meta is pressed */
    ctrlOrCmdKey?: boolean;

    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
};

export type KeyBinding = {
    action: KeyBindingAction;
    keyCombo: KeyCombo;
};

/**
 * Helper method to check if a KeyboardEvent matches a KeyCombo
 *
 * Note, this method is only exported for testing.
 */
export function isKeyComboMatch(ev: KeyboardEvent | React.KeyboardEvent, combo: KeyCombo, onMac: boolean): boolean {
    // Letters are reported as upper case chars whenever shift is pressed or caps lock is on, so the
    // comparison has to be case insensitive. This works for letter combos such as shift + U as well
    // as for none letter combos such as shift + Escape. No two entries of the `Key` map collide once
    // lower cased, so this cannot make two distinct shortcuts overlap.
    // Dropdown, the room context menus and EditableText all forward a mouse ButtonEvent to
    // getAccessibilityAction cast as a KeyboardEvent, so the event's `key` can genuinely be absent at
    // runtime. Such an event must match no combo, as it did before the comparison became case
    // insensitive.
    if (ev.key?.toLowerCase() !== combo.key.toLowerCase()) {
        return false;
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
    if (combo.ctrlOrCmdKey) {
        if (onMac) {
            if (!evMeta || evCtrl !== comboCtrl || evAlt !== comboAlt || evShift !== comboShift) {
                return false;
            }
        } else {
            if (!evCtrl || evMeta !== comboMeta || evAlt !== comboAlt || evShift !== comboShift) {
                return false;
            }
        }
        return true;
    }

    if (evMeta !== comboMeta || evCtrl !== comboCtrl || evAlt !== comboAlt || evShift !== comboShift) {
        return false;
    }

    return true;
}

export type KeyBindingGetter = () => KeyBinding[];

export interface IKeyBindingsProvider {
    [key: string]: KeyBindingGetter;
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
    public bindingsProviders: IKeyBindingsProvider[] = [defaultBindingsProvider];

    /**
     * Finds a matching KeyAction for a given KeyboardEvent
     */
    private getAction(
        getters: KeyBindingGetter[],
        ev: KeyboardEvent | React.KeyboardEvent,
    ): KeyBindingAction | undefined {
        for (const getter of getters) {
            const bindings = getter();
            const binding = bindings.find((it) => isKeyComboMatch(ev, it.keyCombo, IS_MAC));
            if (binding) {
                return binding.action;
            }
        }
        return undefined;
    }

    public getMessageComposerAction(ev: KeyboardEvent | React.KeyboardEvent): KeyBindingAction | undefined {
        return this.getAction(
            this.bindingsProviders.map((it) => it.getMessageComposerBindings),
            ev,
        );
    }

    public getAutocompleteAction(ev: KeyboardEvent | React.KeyboardEvent): KeyBindingAction | undefined {
        return this.getAction(
            this.bindingsProviders.map((it) => it.getAutocompleteBindings),
            ev,
        );
    }

    public getRoomListAction(ev: KeyboardEvent | React.KeyboardEvent): KeyBindingAction | undefined {
        return this.getAction(
            this.bindingsProviders.map((it) => it.getRoomListBindings),
            ev,
        );
    }

    public getRoomAction(ev: KeyboardEvent | React.KeyboardEvent): KeyBindingAction | undefined {
        return this.getAction(
            this.bindingsProviders.map((it) => it.getRoomBindings),
            ev,
        );
    }

    public getNavigationAction(ev: KeyboardEvent | React.KeyboardEvent): KeyBindingAction | undefined {
        return this.getAction(
            this.bindingsProviders.map((it) => it.getNavigationBindings),
            ev,
        );
    }

    public getAccessibilityAction(ev: KeyboardEvent | React.KeyboardEvent): KeyBindingAction | undefined {
        return this.getAction(
            this.bindingsProviders.map((it) => it.getAccessibilityBindings),
            ev,
        );
    }

    public getCallAction(ev: KeyboardEvent | React.KeyboardEvent): KeyBindingAction | undefined {
        return this.getAction(
            this.bindingsProviders.map((it) => it.getCallBindings),
            ev,
        );
    }

    public getLabsAction(ev: KeyboardEvent | React.KeyboardEvent): KeyBindingAction | undefined {
        return this.getAction(
            this.bindingsProviders.map((it) => it.getLabsBindings),
            ev,
        );
    }
}

const manager = new KeyBindingsManager();

export function getKeyBindingsManager(): KeyBindingsManager {
    return manager;
}
