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
    insertCustomEmoticon(src: string, text: string): void;
} {
    return useMemo(
        () => ({
            clear: () => {
                if (ref.current) {
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
            insertCustomEmoticon: (src: string, text: string) => {
                if (!ref.current) return;

                const selection = document.getSelection();
                const image = document.createElement("img");
                image.setAttribute("data-mx-emoticon", "");
                image.setAttribute("contenteditable", "false");
                image.src = src;
                image.alt = text;
                image.title = text;
                image.width = 32;
                image.height = 32;

                const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
                if (range && ref.current.contains(range.commonAncestorContainer)) {
                    range.deleteContents();
                    range.insertNode(image);
                    range.setStartAfter(image);
                    range.collapse(true);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                } else {
                    ref.current.appendChild(image);
                }
                setContent(ref.current.innerHTML);
            },
        }),
        [ref, setContent],
    );
}
