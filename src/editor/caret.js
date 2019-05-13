/*
Copyright 2019 New Vector Ltd

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
    let lineIndex = 0;
    let nodeIndex = -1;
    for (let i = 0; i <= caretPosition.index; ++i) {
        const part = parts[i];
        if (part && part.type === "newline") {
            lineIndex += 1;
            nodeIndex = -1;
        } else {
            nodeIndex += 1;
        }
    }
    let focusNode;
    const lineNode = editor.childNodes[lineIndex];
    if (lineNode) {
        if (lineNode.childNodes.length === 0 && caretPosition.offset === 0) {
            focusNode = lineNode;
        } else {
            focusNode = lineNode.childNodes[nodeIndex];

            if (focusNode && focusNode.nodeType === Node.ELEMENT_NODE) {
                focusNode = focusNode.childNodes[0];
            }
        }
    }
    // node not found, set caret at end
    if (!focusNode) {
        range.selectNodeContents(editor);
        range.collapse(false);
    } else {
        // make sure we have a text node
        range.setStart(focusNode, caretPosition.offset);
        range.collapse(true);
    }
    sel.addRange(range);
}
