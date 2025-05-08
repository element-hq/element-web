/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect } from "react";

import useFocus from "../../../../../hooks/useFocus";
import { useComposerContext, type ComposerContextState } from "../ComposerContext";

function setSelectionContext(composerContext: ComposerContextState): void {
    const selection = document.getSelection();

    if (selection) {
        const range = selection.getRangeAt(0);
        const isForward = range.startContainer === selection.anchorNode && range.startOffset === selection.anchorOffset;

        composerContext.selection = {
            anchorNode: selection.anchorNode,
            anchorOffset: selection.anchorOffset,
            focusNode: selection.focusNode,
            focusOffset: selection.focusOffset,
            isForward,
        };
    }
}

export function useSelection(): ReturnType<typeof useFocus>[1] & {
    onInput(): void;
} {
    const composerContext = useComposerContext();
    const [isFocused, focusProps] = useFocus();

    useEffect(() => {
        function onSelectionChange(): void {
            setSelectionContext(composerContext);
        }

        if (isFocused) {
            document.addEventListener("selectionchange", onSelectionChange);
        }

        return () => document.removeEventListener("selectionchange", onSelectionChange);
    }, [isFocused, composerContext]);

    const onInput = useCallback(() => {
        setSelectionContext(composerContext);
    }, [composerContext]);

    return { ...focusProps, onInput };
}
