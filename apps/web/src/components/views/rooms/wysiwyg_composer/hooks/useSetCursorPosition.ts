/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RefObject, useEffect } from "react";

import { setCursorPositionAtTheEnd } from "./utils";

export function useSetCursorPosition(disabled: boolean, ref: RefObject<HTMLDivElement | null>): void {
    useEffect(() => {
        // When a room opens with the thread panel open, the thread composer mounts after the main composer,
        // so don't let composers in the right panel steal focus. Edit composers only mount when the user
        // starts editing, so they still take focus.
        const inRightPanel = ref.current?.closest(".mx_RightPanel") && !ref.current.closest(".mx_EditWysiwygComposer");
        if (ref.current && !disabled && !inRightPanel) {
            setCursorPositionAtTheEnd(ref.current);
        }
    }, [ref, disabled]);
}
