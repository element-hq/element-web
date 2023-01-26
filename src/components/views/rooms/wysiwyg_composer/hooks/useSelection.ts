/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { useCallback, useEffect } from "react";

import useFocus from "../../../../../hooks/useFocus";
import { useComposerContext, ComposerContextState } from "../ComposerContext";

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
