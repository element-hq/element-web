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

export function getCaretOffset(editor) {
    const sel = document.getSelection();
    const atNodeEnd = sel.focusOffset === sel.focusNode.textContent.length;
    let offset = sel.focusOffset;
    let node = sel.focusNode;

    // when deleting the last character of a node,
    // the caret gets reported as being after the focusOffset-th node,
    // with the focusNode being the editor
    if (node === editor) {
        let offset = 0;
        for (let i = 0; i < sel.focusOffset; ++i) {
            const node = editor.childNodes[i];
            if (isVisibleNode(node)) {
                offset += node.textContent.length;
            }
        }
        return {offset, atNodeEnd: false};
    }

    // first make sure we're at the level of a direct child of editor
    if (node.parentElement !== editor) {
        // include all preceding siblings of the non-direct editor children
        while (node.previousSibling) {
            node = node.previousSibling;
            if (isVisibleNode(node)) {
                offset += node.textContent.length;
            }
        }
        // then move up
        // I guess technically there could be preceding text nodes in the parents here as well,
        // but we're assuming there are no mixed text and element nodes
        while (node.parentElement !== editor) {
            node = node.parentElement;
        }
    }
    // now include the text length of all preceding direct editor children
    while (node.previousSibling) {
        node = node.previousSibling;
        if (isVisibleNode(node)) {
            offset += node.textContent.length;
        }
    }
    // {
    //     const {focusOffset, focusNode} = sel;
    //     console.log("selection", {focusOffset, focusNode, position, atNodeEnd});
    // }
    return {offset, atNodeEnd};
}

function isVisibleNode(node) {
    return node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE;
}

function untilVisibleNode(node) {
    // need to ignore comment nodes that react uses
    while (node && !isVisibleNode(node)) {
        node = node.nextSibling;
    }
    return node;
}

export function setCaretPosition(editor, caretPosition) {
    let node = untilVisibleNode(editor.firstChild);
    if (!node) {
        node = editor;
    } else {
        let {index} = caretPosition;
        while (node && index) {
            node = untilVisibleNode(node.nextSibling);
            --index;
        }
        if (!node) {
            node = editor;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // make sure we have a text node
            node = node.childNodes[0];
        }
    }
    const sel = document.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.setStart(node, caretPosition.offset);
    range.collapse(true);
    sel.addRange(range);
}
