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

import { RefObject, useMemo } from "react";

import { setSelection } from "../utils/selection";

export function useComposerFunctions(
    ref: RefObject<HTMLDivElement>,
    setContent: (content: string) => void,
): {
    clear(): void;
    insertText(text: string): void;
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
        }),
        [ref, setContent],
    );
}
