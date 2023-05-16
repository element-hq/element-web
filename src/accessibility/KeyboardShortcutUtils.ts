/*
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

import { KeyCombo } from "../KeyBindingsManager";
import { IS_MAC, Key } from "../Keyboard";
import { _t, _td } from "../languageHandler";
import PlatformPeg from "../PlatformPeg";
import SettingsStore from "../settings/SettingsStore";
import {
    DESKTOP_SHORTCUTS,
    DIGITS,
    IKeyboardShortcuts,
    KeyBindingAction,
    KEYBOARD_SHORTCUTS,
    MAC_ONLY_SHORTCUTS,
} from "./KeyboardShortcuts";
import { IBaseSetting } from "../settings/Settings";

/**
 * This function gets the keyboard shortcuts that should be presented in the UI
 * but they shouldn't be consumed by KeyBindingDefaults. That means that these
 * have to be manually mirrored in KeyBindingDefaults.
 */
const getUIOnlyShortcuts = (): IKeyboardShortcuts => {
    const ctrlEnterToSend = SettingsStore.getValue("MessageComposerInput.ctrlEnterToSend");

    const keyboardShortcuts: IKeyboardShortcuts = {
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
    };

    if (PlatformPeg.get()?.overrideBrowserShortcuts()) {
        // XXX: This keyboard shortcut isn't manually added to
        // KeyBindingDefaults as it can't be easily handled by the
        // KeyBindingManager
        keyboardShortcuts[KeyBindingAction.SwitchToSpaceByNumber] = {
            default: {
                ctrlOrCmdKey: true,
                key: DIGITS,
            },
            displayName: _td("Switch to space by number"),
        };
    }

    return keyboardShortcuts;
};

/**
 * This function gets keyboard shortcuts that can be consumed by the KeyBindingDefaults.
 */
export const getKeyboardShortcuts = (): IKeyboardShortcuts => {
    const overrideBrowserShortcuts = PlatformPeg.get()?.overrideBrowserShortcuts();

    return (Object.keys(KEYBOARD_SHORTCUTS) as KeyBindingAction[])
        .filter((k) => {
            if (KEYBOARD_SHORTCUTS[k]?.controller?.settingDisabled) return false;
            if (MAC_ONLY_SHORTCUTS.includes(k) && !IS_MAC) return false;
            if (DESKTOP_SHORTCUTS.includes(k) && !overrideBrowserShortcuts) return false;

            return true;
        })
        .reduce((o, key) => {
            o[key as KeyBindingAction] = KEYBOARD_SHORTCUTS[key as KeyBindingAction];
            return o;
        }, {} as IKeyboardShortcuts);
};

/**
 * Gets keyboard shortcuts that should be presented to the user in the UI.
 */
export const getKeyboardShortcutsForUI = (): IKeyboardShortcuts => {
    const entries = [...Object.entries(getUIOnlyShortcuts()), ...Object.entries(getKeyboardShortcuts())] as [
        KeyBindingAction,
        IBaseSetting<KeyCombo>,
    ][];

    return entries.reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
    }, {} as IKeyboardShortcuts);
};

export const getKeyboardShortcutValue = (name: KeyBindingAction): KeyCombo | undefined => {
    return getKeyboardShortcutsForUI()[name]?.default;
};

export const getKeyboardShortcutDisplayName = (name: KeyBindingAction): string | undefined => {
    const keyboardShortcutDisplayName = getKeyboardShortcutsForUI()[name]?.displayName;
    return keyboardShortcutDisplayName && _t(keyboardShortcutDisplayName as string);
};
