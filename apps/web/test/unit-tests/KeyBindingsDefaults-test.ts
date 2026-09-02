/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defaultBindingsProvider } from "../../src/KeyBindingsDefaults";
import SettingsStore from "../../src/settings/SettingsStore";
import { KeyBindingAction } from "../../src/accessibility/KeyboardShortcuts";
import { type KeyBinding } from "../../src/KeyBindingsManager";
import { Key } from "../../src/Keyboard";

const searchBinding = (bindings: KeyBinding[]): KeyBinding | undefined =>
    bindings.find((b) => b.action === KeyBindingAction.SearchInRoom);

describe("defaultBindingsProvider.getRoomBindings", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("registers the Ctrl/Cmd+F room-search binding when ctrlFForSearch is enabled", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name) => name === "ctrlFForSearch");

        const binding = searchBinding(defaultBindingsProvider.getRoomBindings());

        expect(binding).toBeDefined();
        expect(binding!.keyCombo).toEqual({ key: Key.F, ctrlOrCmdKey: true });
    });

    it("omits the room-search binding when ctrlFForSearch is disabled", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);

        expect(searchBinding(defaultBindingsProvider.getRoomBindings())).toBeUndefined();
    });
});
