/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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

/* a selection of key codes, as used in KeyboardEvent.keyCode */
export const KeyCode = {
    BACKSPACE: 8,
    TAB: 9,
    ENTER: 13,
    SHIFT: 16,
    ESCAPE: 27,
    SPACE: 32,
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    END: 35,
    HOME: 36,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    DELETE: 46,
    KEY_A: 65,
    KEY_B: 66,
    KEY_C: 67,
    KEY_D: 68,
    KEY_E: 69,
    KEY_F: 70,
    KEY_G: 71,
    KEY_H: 72,
    KEY_I: 73,
    KEY_J: 74,
    KEY_K: 75,
    KEY_L: 76,
    KEY_M: 77,
    KEY_N: 78,
    KEY_O: 79,
    KEY_P: 80,
    KEY_Q: 81,
    KEY_R: 82,
    KEY_S: 83,
    KEY_T: 84,
    KEY_U: 85,
    KEY_V: 86,
    KEY_W: 87,
    KEY_X: 88,
    KEY_Y: 89,
    KEY_Z: 90,
    KEY_BACKTICK: 223, // DO NOT USE THIS: browsers disagree on backtick 192 vs 223
};

export const Key = {
    HOME: "Home",
    End: "End",
    PAGE_UP: "PageUp",
    PAGE_DOWN: "PageDown",
    BACKSPACE: "Backspace",
    BACKTICK: "`",
    SPACE: " ",
    ENTER: "Enter",

    K: "k",
};

export function isOnlyCtrlOrCmdKeyEvent(ev) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (isMac) {
        return ev.metaKey && !ev.altKey && !ev.ctrlKey && !ev.shiftKey;
    } else {
        return ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.shiftKey;
    }
}

export function isOnlyCtrlOrCmdIgnoreShiftKeyEvent(ev) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (isMac) {
        return ev.metaKey && !ev.altKey && !ev.ctrlKey;
    } else {
        return ev.ctrlKey && !ev.altKey && !ev.metaKey;
    }
}
