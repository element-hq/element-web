/*
Copyright 2024 New Vector Ltd.
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2021 Clemens Zeidler

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { IS_MAC, Key } from "./Keyboard";
import SettingsStore from "./settings/SettingsStore";
import SdkConfig from "./SdkConfig";
import { type IKeyBindingsProvider, type KeyBinding } from "./KeyBindingsManager";
import { CATEGORIES, CategoryName, KeyBindingAction } from "./accessibility/KeyboardShortcuts";
import { getKeyboardShortcuts } from "./accessibility/KeyboardShortcutUtils";

export const getBindingsByCategory = (category: CategoryName): KeyBinding[] => {
    return CATEGORIES[category].settingNames.reduce<KeyBinding[]>((bindings, action) => {
        const keyCombo = getKeyboardShortcuts()[action]?.default;
        if (keyCombo) {
            bindings.push({ action, keyCombo });
        }
        return bindings;
    }, []);
};

const messageComposerBindings = (): KeyBinding[] => {
    const bindings = getBindingsByCategory(CategoryName.COMPOSER);

    if (SettingsStore.getValue("MessageComposerInput.ctrlEnterToSend")) {
        bindings.push({
            action: KeyBindingAction.SendMessage,
            keyCombo: {
                key: Key.ENTER,
                ctrlOrCmdKey: true,
            },
        });
        bindings.push({
            action: KeyBindingAction.NewLine,
            keyCombo: {
                key: Key.ENTER,
            },
        });
        bindings.push({
            action: KeyBindingAction.NewLine,
            keyCombo: {
                key: Key.ENTER,
                shiftKey: true,
            },
        });
    } else {
        bindings.push({
            action: KeyBindingAction.SendMessage,
            keyCombo: {
                key: Key.ENTER,
            },
        });
        bindings.push({
            action: KeyBindingAction.NewLine,
            keyCombo: {
                key: Key.ENTER,
                shiftKey: true,
            },
        });
        if (IS_MAC) {
            bindings.push({
                action: KeyBindingAction.NewLine,
                keyCombo: {
                    key: Key.ENTER,
                    altKey: true,
                },
            });
        }
    }

    return bindings;
};

const autocompleteBindings = (): KeyBinding[] => {
    const bindings = getBindingsByCategory(CategoryName.AUTOCOMPLETE);

    bindings.push({
        action: KeyBindingAction.ForceCompleteAutocomplete,
        keyCombo: {
            key: Key.TAB,
        },
    });
    bindings.push({
        action: KeyBindingAction.ForceCompleteAutocomplete,
        keyCombo: {
            key: Key.TAB,
            ctrlKey: true,
        },
    });
    bindings.push({
        action: KeyBindingAction.CompleteAutocomplete,
        keyCombo: {
            key: Key.ENTER,
        },
    });
    bindings.push({
        action: KeyBindingAction.CompleteAutocomplete,
        keyCombo: {
            key: Key.ENTER,
            ctrlKey: true,
        },
    });

    return bindings;
};

const roomListBindings = (): KeyBinding[] => {
    return getBindingsByCategory(CategoryName.ROOM_LIST);
};

const roomBindings = (): KeyBinding[] => {
    const bindings = getBindingsByCategory(CategoryName.ROOM);

    if (SettingsStore.getValue("ctrlFForSearch")) {
        bindings.push({
            action: KeyBindingAction.SearchInRoom,
            keyCombo: {
                key: Key.F,
                ctrlOrCmdKey: true,
            },
        });
    }

    return bindings;
};

const navigationBindings = (): KeyBinding[] => {
    return getBindingsByCategory(CategoryName.NAVIGATION);
};

const accessibilityBindings = (): KeyBinding[] => {
    return getBindingsByCategory(CategoryName.ACCESSIBILITY);
};

const callBindings = (): KeyBinding[] => {
    return getBindingsByCategory(CategoryName.CALLS);
};

const labsBindings = (): KeyBinding[] => {
    if (!SdkConfig.get("show_labs_settings")) return [];

    return getBindingsByCategory(CategoryName.LABS);
};

export const defaultBindingsProvider: IKeyBindingsProvider = {
    getMessageComposerBindings: messageComposerBindings,
    getAutocompleteBindings: autocompleteBindings,
    getRoomListBindings: roomListBindings,
    getRoomBindings: roomBindings,
    getNavigationBindings: navigationBindings,
    getAccessibilityBindings: accessibilityBindings,
    getCallBindings: callBindings,
    getLabsBindings: labsBindings,
};
