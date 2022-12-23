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

import { SubSelection } from "../types";

export function setSelection(selection: SubSelection) {
    if (selection.anchorNode && selection.focusNode) {
        const range = new Range();
        range.setStart(selection.anchorNode, selection.anchorOffset);
        range.setEnd(selection.focusNode, selection.focusOffset);

        document.getSelection()?.removeAllRanges();
        document.getSelection()?.addRange(range);
    }

    // Waiting for the next loop to ensure that the selection is effective
    return new Promise((resolve) => setTimeout(resolve, 0));
}

export function isSelectionEmpty() {
    const selection = document.getSelection();
    return Boolean(selection?.isCollapsed);
}
