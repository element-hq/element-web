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

import { RefObject, useCallback, useEffect, useRef } from "react";

import useFocus from "../../../../../hooks/useFocus";

export function useSelection(ref: RefObject<HTMLDivElement>) {
    const selectionRef = useRef({
        anchorOffset: 0,
        focusOffset: 0,
    });
    const [isFocused, focusProps] = useFocus();

    useEffect(() => {
        function onSelectionChange() {
            const selection = document.getSelection();
            console.log('selection', selection);
            selectionRef.current = {
                anchorOffset: selection.anchorOffset,
                focusOffset: selection.focusOffset,
            };
        }

        if (isFocused) {
            document.addEventListener('selectionchange', onSelectionChange);
        }

        return () => document.removeEventListener('selectionchange', onSelectionChange);
    }, [isFocused]);

    const selectPreviousSelection = useCallback(() => {
        const range = new Range();
        range.setStart(ref.current.firstChild, selectionRef.current.anchorOffset);
        range.setEnd(ref.current.firstChild, selectionRef.current.focusOffset);
        document.getSelection().removeAllRanges();
        document.getSelection().addRange(range);
    }, [selectionRef, ref]);

    return { ...focusProps, selectPreviousSelection };
}
