/*
Copyright 2021 Clemens Zeidler
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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

import { KeyBindingAction } from "./accessibility/KeyboardShortcuts";
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
