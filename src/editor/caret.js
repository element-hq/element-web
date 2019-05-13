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
    console.info("getCaretOffset", sel.focusNode, sel.focusOffset);
    // when deleting the last character of a node,
    // the caret gets reported as being after the focusOffset-th node,
    // with the focusNode being the editor
    let offset = 0;
    let node;
    let atNodeEnd = true;
    if (sel.focusNode.nodeType === Node.TEXT_NODE) {
        node = sel.focusNode;
        offset = sel.focusOffset;
        atNodeEnd = sel.focusOffset === sel.focusNode.textContent.length;
    } else if (sel.focusNode.nodeType === Node.ELEMENT_NODE) {
        node = sel.focusNode.childNodes[sel.focusOffset];
        offset = nodeLength(node);
    }

    while (node !== editor) {
        while (node.previousSibling) {
            node = node.previousSibling;
            offset += nodeLength(node);
        }
        // then 1 move up
        node = node.parentElement;
    }

    return {offset, atNodeEnd};


    // // first make sure we're at the level of a direct child of editor
    // if (node.parentElement !== editor) {
    //     // include all preceding siblings of the non-direct editor children
    //     while (node.previousSibling) {
    //         node = node.previousSibling;
    //         offset += nodeLength(node);
    //     }
    //     // then move up
    //     // I guess technically there could be preceding text nodes in the parents here as well,
    //     // but we're assuming there are no mixed text and element nodes
    //     while (node.parentElement !== editor) {
    //         node = node.parentElement;
    //     }
    // }
    // // now include the text length of all preceding direct editor children
    // while (node.previousSibling) {
    //     node = node.previousSibling;
    //     offset += nodeLength(node);
    // }
    // {
    //     const {focusOffset, focusNode} = sel;
    //     console.log("selection", {focusOffset, focusNode, position, atNodeEnd});
    // }
}

function nodeLength(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        const isBlock = node.tagName === "DIV";
        const isLastDiv = !node.nextSibling || node.nextSibling.tagName !== "DIV";
        return node.textContent.length + ((isBlock && !isLastDiv) ? 1 : 0);
    } else {
        return node.textContent.length;
    }
}

export function setCaretPosition(editor, caretPosition) {
    const sel = document.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    let focusNode = editor.childNodes[caretPosition.index];
    // node not found, set caret at end
    if (!focusNode) {
        range.selectNodeContents(editor);
        range.collapse(false);
    } else {
        // make sure we have a text node
        if (focusNode.nodeType === Node.ELEMENT_NODE) {
            focusNode = focusNode.childNodes[0];
        }
        range.setStart(focusNode, caretPosition.offset);
        range.collapse(true);
    }
    sel.addRange(range);
}
