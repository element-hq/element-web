/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Clemens Zeidler

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";

import { isKeyComboMatch, type KeyCombo } from "./KeyBindingsManager";
import { Key } from "./Keyboard";

function mockKeyEvent(
    key: string,
    modifiers?: {
        ctrlKey?: boolean;
        altKey?: boolean;
        shiftKey?: boolean;
        metaKey?: boolean;
    },
): KeyboardEvent {
    return {
        key,
        ctrlKey: modifiers?.ctrlKey ?? false,
        altKey: modifiers?.altKey ?? false,
        shiftKey: modifiers?.shiftKey ?? false,
        metaKey: modifiers?.metaKey ?? false,
    } as KeyboardEvent;
}

describe("KeyBindingsManager", () => {
    it("should match basic key combo", () => {
        const combo1: KeyCombo = {
            key: "k",
        };
        expect(isKeyComboMatch(mockKeyEvent("k"), combo1, false)).toBe(true);
        expect(isKeyComboMatch(mockKeyEvent("n"), combo1, false)).toBe(false);
    });

    it("should match key + modifier key combo", () => {
        const combo: KeyCombo = {
            key: "k",
            ctrlKey: true,
        };
        expect(isKeyComboMatch(mockKeyEvent("k", { ctrlKey: true }), combo, false)).toBe(true);
        expect(isKeyComboMatch(mockKeyEvent("n", { ctrlKey: true }), combo, false)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("k"), combo, false)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("k", { shiftKey: true }), combo, false)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("k", { shiftKey: true, metaKey: true }), combo, false)).toBe(false);

        const combo2: KeyCombo = {
            key: "k",
            metaKey: true,
        };
        expect(isKeyComboMatch(mockKeyEvent("k", { metaKey: true }), combo2, false)).toBe(true);
        expect(isKeyComboMatch(mockKeyEvent("n", { metaKey: true }), combo2, false)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("k"), combo2, false)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("k", { altKey: true, metaKey: true }), combo2, false)).toBe(false);

        const combo3: KeyCombo = {
            key: "k",
            altKey: true,
        };
        expect(isKeyComboMatch(mockKeyEvent("k", { altKey: true }), combo3, false)).toBe(true);
        expect(isKeyComboMatch(mockKeyEvent("n", { altKey: true }), combo3, false)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("k"), combo3, false)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("k", { ctrlKey: true, metaKey: true }), combo3, false)).toBe(false);

        const combo4: KeyCombo = {
            key: "k",
            shiftKey: true,
        };
        expect(isKeyComboMatch(mockKeyEvent("k", { shiftKey: true }), combo4, false)).toBe(true);
        expect(isKeyComboMatch(mockKeyEvent("n", { shiftKey: true }), combo4, false)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("k"), combo4, false)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("k", { shiftKey: true, ctrlKey: true }), combo4, false)).toBe(false);
    });

    it("should match key + multiple modifiers key combo", () => {
        const combo: KeyCombo = {
            key: "k",
            ctrlKey: true,
            altKey: true,
        };
        expect(isKeyComboMatch(mockKeyEvent("k", { ctrlKey: true, altKey: true }), combo, false)).toBe(true);
        expect(isKeyComboMatch(mockKeyEvent("n", { ctrlKey: true, altKey: true }), combo, false)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("k", { ctrlKey: true, metaKey: true }), combo, false)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("k", { ctrlKey: true, metaKey: true, shiftKey: true }), combo, false)).toBe(
            false,
        );

        const combo2: KeyCombo = {
            key: "k",
            ctrlKey: true,
            shiftKey: true,
            altKey: true,
        };
        expect(isKeyComboMatch(mockKeyEvent("k", { ctrlKey: true, shiftKey: true, altKey: true }), combo2, false)).toBe(
            true,
        );
        expect(isKeyComboMatch(mockKeyEvent("n", { ctrlKey: true, shiftKey: true, altKey: true }), combo2, false)).toBe(
            false,
        );
        expect(isKeyComboMatch(mockKeyEvent("k", { ctrlKey: true, metaKey: true }), combo2, false)).toBe(false);
        expect(
            isKeyComboMatch(
                mockKeyEvent("k", { ctrlKey: true, shiftKey: true, altKey: true, metaKey: true }),
                combo2,
                false,
            ),
        ).toBe(false);

        const combo3: KeyCombo = {
            key: "k",
            ctrlKey: true,
            shiftKey: true,
            altKey: true,
            metaKey: true,
        };
        expect(
            isKeyComboMatch(
                mockKeyEvent("k", { ctrlKey: true, shiftKey: true, altKey: true, metaKey: true }),
                combo3,
                false,
            ),
        ).toBe(true);
        expect(
            isKeyComboMatch(
                mockKeyEvent("n", { ctrlKey: true, shiftKey: true, altKey: true, metaKey: true }),
                combo3,
                false,
            ),
        ).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("k", { ctrlKey: true, shiftKey: true, altKey: true }), combo3, false)).toBe(
            false,
        );
    });

    it("should match ctrlOrMeta key combo", () => {
        const combo: KeyCombo = {
            key: "k",
            ctrlOrCmdKey: true,
        };
        // PC:
        expect(isKeyComboMatch(mockKeyEvent("k", { ctrlKey: true }), combo, false)).toBe(true);
        expect(isKeyComboMatch(mockKeyEvent("k", { metaKey: true }), combo, false)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("n", { ctrlKey: true }), combo, false)).toBe(false);
        // MAC:
        expect(isKeyComboMatch(mockKeyEvent("k", { metaKey: true }), combo, true)).toBe(true);
        expect(isKeyComboMatch(mockKeyEvent("k", { ctrlKey: true }), combo, true)).toBe(false);
        expect(isKeyComboMatch(mockKeyEvent("n", { ctrlKey: true }), combo, true)).toBe(false);
    });

    it("should match advanced ctrlOrMeta key combo", () => {
        const combo: KeyCombo = {
            key: "k",
            ctrlOrCmdKey: true,
            altKey: true,
        };
        // PC:
        expect(isKeyComboMatch(mockKeyEvent("k", { ctrlKey: true, altKey: true }), combo, false)).toBe(true);
        expect(isKeyComboMatch(mockKeyEvent("k", { metaKey: true, altKey: true }), combo, false)).toBe(false);
        // MAC:
        expect(isKeyComboMatch(mockKeyEvent("k", { metaKey: true, altKey: true }), combo, true)).toBe(true);
        expect(isKeyComboMatch(mockKeyEvent("k", { ctrlKey: true, altKey: true }), combo, true)).toBe(false);
    });

    it("should match a letter key combo when caps lock is on", () => {
        // With caps lock enabled the browser reports an upper case `key` while `shiftKey` stays false.
        const combo: KeyCombo = {
            key: "k",
            ctrlOrCmdKey: true,
        };
        // PC:
        expect(isKeyComboMatch(mockKeyEvent("K", { ctrlKey: true }), combo, false)).toBe(true);
        expect(isKeyComboMatch(mockKeyEvent("N", { ctrlKey: true }), combo, false)).toBe(false);
        // MAC:
        expect(isKeyComboMatch(mockKeyEvent("K", { metaKey: true }), combo, true)).toBe(true);
        expect(isKeyComboMatch(mockKeyEvent("N", { metaKey: true }), combo, true)).toBe(false);
    });

    it("should not let a case insensitive comparison merge distinct keys", () => {
        // No two entries of the `Key` map collide once lower cased, so comparing case insensitively
        // cannot make two distinct shortcuts overlap.
        const lowerCased = Object.values(Key).map((key) => key.toLowerCase());
        expect(new Set(lowerCased).size).toBe(lowerCased.length);
    });

    it("should not match, rather than throw, when the event carries no key", () => {
        // Dropdown, RoomGeneralContextMenu, RoomNotificationContextMenu and EditableText all hand
        // getAccessibilityAction a ButtonEvent, which for a mouse activation has no `key` at all.
        const combo: KeyCombo = { key: "k", ctrlOrCmdKey: true };
        const clickEvent = { ctrlKey: true } as unknown as KeyboardEvent;
        expect(isKeyComboMatch(clickEvent, combo, false)).toBe(false);
        expect(isKeyComboMatch(clickEvent, combo, true)).toBe(false);
    });
});
