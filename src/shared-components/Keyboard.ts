/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2017 New Vector Ltd
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type React from "react";

export const Key = {
    HOME: "Home",
    END: "End",
    PAGE_UP: "PageUp",
    PAGE_DOWN: "PageDown",
    BACKSPACE: "Backspace",
    DELETE: "Delete",
    ARROW_UP: "ArrowUp",
    ARROW_DOWN: "ArrowDown",
    ARROW_LEFT: "ArrowLeft",
    ARROW_RIGHT: "ArrowRight",
    F6: "F6",
    TAB: "Tab",
    ESCAPE: "Escape",
    ENTER: "Enter",
    ALT: "Alt",
    CONTROL: "Control",
    META: "Meta",
    SHIFT: "Shift",
    CONTEXT_MENU: "ContextMenu",

    COMMA: ",",
    PERIOD: ".",
    LESS_THAN: "<",
    GREATER_THAN: ">",
    BACKTICK: "`",
    SPACE: " ",
    SLASH: "/",
    SQUARE_BRACKET_LEFT: "[",
    SQUARE_BRACKET_RIGHT: "]",
    SEMICOLON: ";",
    A: "a",
    B: "b",
    C: "c",
    D: "d",
    E: "e",
    F: "f",
    G: "g",
    H: "h",
    I: "i",
    J: "j",
    K: "k",
    L: "l",
    M: "m",
    N: "n",
    O: "o",
    P: "p",
    Q: "q",
    R: "r",
    S: "s",
    T: "t",
    U: "u",
    V: "v",
    W: "w",
    X: "x",
    Y: "y",
    Z: "z",
};

export const IS_MAC = navigator.platform.toUpperCase().includes("MAC");
export const IS_ELECTRON = window.electron;

export function isOnlyCtrlOrCmdKeyEvent(ev: React.KeyboardEvent | KeyboardEvent): boolean {
    if (IS_MAC) {
        return ev.metaKey && !ev.altKey && !ev.ctrlKey && !ev.shiftKey;
    } else {
        return ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.shiftKey;
    }
}
