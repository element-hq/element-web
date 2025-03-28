/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RefObject, useMemo } from "react";

import { setSelection } from "../utils/selection";

export function useComposerFunctions(
    ref: RefObject<HTMLDivElement | null>,
    setContent: (content: string) => void,
): {
    clear(): void;
    insertText(text: string): void;
} {
    return useMemo(
        () => ({
            clear: () => {
                if (ref.current) {
                    // eslint-disable-next-line react-compiler/react-compiler
                    ref.current.innerHTML = "";
                }
            },
            insertText: (text: string) => {
                const selection = document.getSelection();

                if (ref.current && selection) {
                    const content = ref.current.innerHTML;
                    const { anchorOffset, focusOffset } = selection;
                    ref.current.innerHTML = `${content.slice(0, anchorOffset)}${text}${content.slice(focusOffset)}`;
                    setSelection({
                        anchorNode: ref.current.firstChild,
                        anchorOffset: anchorOffset + text.length,
                        focusNode: ref.current.firstChild,
                        focusOffset: focusOffset + text.length,
                        isForward: true,
                    });
                    setContent(ref.current.innerHTML);
                }
            },
        }),
        [ref, setContent],
    );
}
