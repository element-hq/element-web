/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

export function setCaretPosition(editor, model, caretPosition) {
    const sel = document.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    const {parts} = model;
    const {index} = caretPosition;
    let {offset} = caretPosition;
    let lineIndex = 0;
    let nodeIndex = -1;
    for (let i = 0; i <= index; ++i) {
        const part = parts[i];
        if (part && part.type === "newline") {
            if (i < index) {
                lineIndex += 1;
                nodeIndex = -1;
            } else {
                // if index points at a newline part,
                // put the caret at the end of the previous part
                // so it stays on the same line
                const prevPart = parts[i - 1];
                offset = prevPart ? prevPart.text.length : 0;
            }
        } else {
            nodeIndex += 1;
        }
    }
    let focusNode;
    const lineNode = editor.childNodes[lineIndex];
    if (lineNode) {
        focusNode = lineNode.childNodes[nodeIndex];
        if (!focusNode) {
            focusNode = lineNode;
        } else if (focusNode.nodeType === Node.ELEMENT_NODE) {
            focusNode = focusNode.childNodes[0];
        }
    }
    // node not found, set caret at end
    if (!focusNode) {
        range.selectNodeContents(editor);
        range.collapse(false);
    } else {
        // make sure we have a text node
        range.setStart(focusNode, offset);
        range.collapse(true);
    }
    sel.addRange(range);
}
