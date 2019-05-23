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

function walkDOMDepthFirst(editor, enterNodeCallback, leaveNodeCallback) {
    let node = editor.firstChild;
    while (node && node !== editor) {
        enterNodeCallback(node);
        if (node.firstChild) {
            node = node.firstChild;
        } else if (node.nextSibling) {
            node = node.nextSibling;
        } else {
            while (!node.nextSibling && node !== editor) {
                node = node.parentElement;
                if (node !== editor) {
                    leaveNodeCallback(node);
                }
            }
            if (node !== editor) {
                node = node.nextSibling;
            }
        }
    }
}

export function getCaretOffsetAndText(editor, sel) {
    let {focusNode} = sel;
    const {focusOffset} = sel;
    let caretOffset = focusOffset;
    let foundCaret = false;
    let text = "";

    if (focusNode.nodeType === Node.ELEMENT_NODE && focusOffset !== 0) {
        focusNode = focusNode.childNodes[focusOffset - 1];
        caretOffset = focusNode.textContent.length;
    }

    function enterNodeCallback(node) {
        const nodeText = node.nodeType === Node.TEXT_NODE && node.nodeValue;
        if (!foundCaret) {
            if (node === focusNode) {
                foundCaret = true;
            }
        }
        if (nodeText) {
            if (!foundCaret) {
                caretOffset += nodeText.length;
            }
            text += nodeText;
        }
    }

    function leaveNodeCallback(node) {
        // if this is not the last DIV (which are only used as line containers atm)
        // we don't just check if there is a nextSibling because sometimes the caret ends up
        // after the last DIV and it creates a newline if you type then,
        // whereas you just want it to be appended to the current line
        if (node.tagName === "DIV" && node.nextSibling && node.nextSibling.tagName === "DIV") {
            text += "\n";
            if (!foundCaret) {
                caretOffset += 1;
            }
        }
    }

    walkDOMDepthFirst(editor, enterNodeCallback, leaveNodeCallback);

    const atNodeEnd = sel.focusOffset === sel.focusNode.textContent.length;
    const caret = {atNodeEnd, offset: caretOffset};
    return {caret, text};
}
