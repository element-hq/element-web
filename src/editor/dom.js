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

import {CARET_NODE_CHAR, isCaretNode} from "./render";

export function walkDOMDepthFirst(rootNode, enterNodeCallback, leaveNodeCallback) {
    let node = rootNode.firstChild;
    while (node && node !== rootNode) {
        const shouldDecend = enterNodeCallback(node);
        if (shouldDecend && node.firstChild) {
            node = node.firstChild;
        } else if (node.nextSibling) {
            node = node.nextSibling;
        } else {
            while (!node.nextSibling && node !== rootNode) {
                node = node.parentElement;
                if (node !== rootNode) {
                    leaveNodeCallback(node);
                }
            }
            if (node !== rootNode) {
                node = node.nextSibling;
            }
        }
    }
}

export function getCaretOffsetAndText(editor, sel) {
    let {focusNode, focusOffset} = sel;
    // sometimes focusNode is an element, and then focusOffset means
    // the index of a child element ... - 1 🤷
    if (focusNode.nodeType === Node.ELEMENT_NODE && focusOffset !== 0) {
        focusNode = focusNode.childNodes[focusOffset - 1];
        focusOffset = focusNode.textContent.length;
    }
    const {text, focusNodeOffset} = getTextAndFocusNodeOffset(editor, focusNode, focusOffset);
    const caret = getCaret(focusNode, focusNodeOffset, focusOffset);
    return {caret, text};
}

// gets the caret position details, ignoring and adjusting to
// the ZWS if you're typing in a caret node
function getCaret(focusNode, focusNodeOffset, focusOffset) {
    let atNodeEnd = focusOffset === focusNode.textContent.length;
    if (focusNode.nodeType === Node.TEXT_NODE && isCaretNode(focusNode.parentElement)) {
        const zwsIdx = focusNode.nodeValue.indexOf(CARET_NODE_CHAR);
        if (zwsIdx !== -1 && zwsIdx < focusOffset) {
            focusOffset -= 1;
        }
        // if typing in a caret node, you're either typing before or after the ZWS.
        // In both cases, you should be considered at node end because the ZWS is
        // not included in the text here, and once the model is updated and rerendered,
        // that caret node will be removed.
        atNodeEnd = true;
    }
    return {offset: focusNodeOffset + focusOffset, atNodeEnd};
}

// gets the text of the editor as a string,
// and the offset in characters where the focusNode starts in that string
// all ZWS from caret nodes are filtered out
function getTextAndFocusNodeOffset(editor, focusNode, focusOffset) {
    let focusNodeOffset = 0;
    let foundCaret = false;
    let text = "";

    function enterNodeCallback(node) {
        if (!foundCaret) {
            if (node === focusNode) {
                foundCaret = true;
            }
        }
        const nodeText = node.nodeType === Node.TEXT_NODE && getTextNodeValue(node);
        if (nodeText) {
            if (!foundCaret) {
                focusNodeOffset += nodeText.length;
            }
            text += nodeText;
        }
        return true;
    }

    function leaveNodeCallback(node) {
        // if this is not the last DIV (which are only used as line containers atm)
        // we don't just check if there is a nextSibling because sometimes the caret ends up
        // after the last DIV and it creates a newline if you type then,
        // whereas you just want it to be appended to the current line
        if (node.tagName === "DIV" && node.nextSibling && node.nextSibling.tagName === "DIV") {
            text += "\n";
            if (!foundCaret) {
                focusNodeOffset += 1;
            }
        }
    }

    walkDOMDepthFirst(editor, enterNodeCallback, leaveNodeCallback);

    return {text, focusNodeOffset};
}

// get text value of text node, ignoring ZWS if it's a caret node
function getTextNodeValue(node) {
    const nodeText = node.nodeValue;
    // filter out ZWS for caret nodes
    if (isCaretNode(node.parentElement)) {
        // typed in the caret node, so there is now something more in it than the ZWS
        // so filter out the ZWS, and take the typed text into account
        if (nodeText.length !== 1) {
            return nodeText.replace(CARET_NODE_CHAR, "");
        } else {
            // only contains ZWS, which is ignored, so return emtpy string
            return "";
        }
    } else {
        return nodeText;
    }
}
