/*
Copyright 2015 - 2017 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd

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

import React from 'react';

/*
import {
    Editor,
    EditorState,
    Modifier,
    ContentState,
    ContentBlock,
    convertFromHTML,
    DefaultDraftBlockRenderMap,
    DefaultDraftInlineStyle,
    CompositeDecorator,
    SelectionState,
    Entity,
} from 'draft-js';
import { stateToMarkdown as __stateToMarkdown } from 'draft-js-export-markdown';
*/

import Html from 'slate-html-serializer';

import * as sdk from './index';
import * as emojione from 'emojione';

import { SelectionRange } from "./autocomplete/Autocompleter";

const MARKDOWN_REGEX = {
    LINK: /(?:\[([^\]]+)\]\(([^\)]+)\))|\<(\w+:\/\/[^\>]+)\>/g,
    ITALIC: /([\*_])([\w\s]+?)\1/g,
    BOLD: /([\*_])\1([\w\s]+?)\1\1/g,
    HR: /(\n|^)((-|\*|_) *){3,}(\n|$)/g,
    CODE: /`[^`]*`/g,
    STRIKETHROUGH: /~{2}[^~]*~{2}/g,
};

const ZWS_CODE = 8203;
const ZWS = String.fromCharCode(ZWS_CODE); // zero width space

export function stateToMarkdown(state) {
    return __stateToMarkdown(state)
        .replace(
            ZWS, // draft-js-export-markdown adds these
            ''); // this is *not* a zero width space, trust me :)
}

export function unicodeToEmojiUri(str) {
    let replaceWith, unicode, alt;
    if ((!emojione.unicodeAlt) || (emojione.sprites)) {
        // if we are using the shortname as the alt tag then we need a reversed array to map unicode code point to shortnames
        const mappedUnicode = emojione.mapUnicodeToShort();
    }

    str = str.replace(emojione.regUnicode, function(unicodeChar) {
        if ( (typeof unicodeChar === 'undefined') || (unicodeChar === '') || (!(unicodeChar in emojione.jsEscapeMap)) ) {
            // if the unicodeChar doesnt exist just return the entire match
            return unicodeChar;
        } else {
            // Remove variant selector VS16 (explicitly emoji) as it is unnecessary and leads to an incorrect URL below
            if (unicodeChar.length == 2 && unicodeChar[1] == '\ufe0f') {
                unicodeChar = unicodeChar[0];
            }

            // get the unicode codepoint from the actual char
            unicode = emojione.jsEscapeMap[unicodeChar];

            return emojione.imagePathSVG+unicode+'.svg'+emojione.cacheBustParam;
        }
    });

    return str;
}

/**
 * Utility function that looks for regex matches within a ContentBlock and invokes {callback} with (start, end)
 * From https://facebook.github.io/draft-js/docs/advanced-topics-decorators.html
 */
function findWithRegex(regex, contentBlock: ContentBlock, callback: (start: number, end: number) => any) {
    const text = contentBlock.getText();
    let matchArr, start;
    while ((matchArr = regex.exec(text)) !== null) {
        start = matchArr.index;
        callback(start, start + matchArr[0].length);
    }
}

/**
 * Returns a composite decorator which has access to provided scope.
 */
export function getScopedRTDecorators(scope: any): CompositeDecorator {
    return [emojiDecorator];
}

export function getScopedMDDecorators(scope: any): CompositeDecorator {
    const markdownDecorators = ['HR', 'BOLD', 'ITALIC', 'CODE', 'STRIKETHROUGH'].map(
        (style) => ({
            strategy: (contentState, contentBlock, callback) => {
                return findWithRegex(MARKDOWN_REGEX[style], contentBlock, callback);
            },
            component: (props) => (
                <span className={"mx_MarkdownElement mx_Markdown_" + style}>
                    { props.children }
                </span>
            ),
        }));

    markdownDecorators.push({
        strategy: (contentState, contentBlock, callback) => {
            return findWithRegex(MARKDOWN_REGEX.LINK, contentBlock, callback);
        },
        component: (props) => (
            <a href="#" className="mx_MarkdownElement mx_Markdown_LINK">
                { props.children }
            </a>
        ),
    });
    // markdownDecorators.push(emojiDecorator);
    // TODO Consider renabling "syntax highlighting" when we can do it properly
    return [emojiDecorator];
}

/**
 * Passes rangeToReplace to modifyFn and replaces it in contentState with the result.
 */
export function modifyText(contentState: ContentState, rangeToReplace: SelectionState,
                           modifyFn: (text: string) => string, inlineStyle, entityKey): ContentState {
    let getText = (key) => contentState.getBlockForKey(key).getText(),
        startKey = rangeToReplace.getStartKey(),
        startOffset = rangeToReplace.getStartOffset(),
        endKey = rangeToReplace.getEndKey(),
        endOffset = rangeToReplace.getEndOffset(),
        text = "";


    for (let currentKey = startKey;
            currentKey && currentKey !== endKey;
            currentKey = contentState.getKeyAfter(currentKey)) {
        const blockText = getText(currentKey);
        text += blockText.substring(startOffset, blockText.length);

        // from now on, we'll take whole blocks
        startOffset = 0;
    }

    // add remaining part of last block
    text += getText(endKey).substring(startOffset, endOffset);

    return Modifier.replaceText(contentState, rangeToReplace, modifyFn(text), inlineStyle, entityKey);
}

/**
 * Computes the plaintext offsets of the given SelectionState.
 * Note that this inherently means we make assumptions about what that means (no separator between ContentBlocks, etc)
 * Used by autocomplete to show completions when the current selection lies within, or at the edges of a command.
 */
export function selectionStateToTextOffsets(selectionState: SelectionState,
                                            contentBlocks: Array<ContentBlock>): {start: number, end: number} {
    let offset = 0, start = 0, end = 0;
    for (const block of contentBlocks) {
        if (selectionState.getStartKey() === block.getKey()) {
            start = offset + selectionState.getStartOffset();
        }
        if (selectionState.getEndKey() === block.getKey()) {
            end = offset + selectionState.getEndOffset();
            break;
        }
        offset += block.getLength();
    }

    return {
        start,
        end,
    };
}

export function hasMultiLineSelection(editorState: EditorState): boolean {
    const selectionState = editorState.getSelection();
    const anchorKey = selectionState.getAnchorKey();
    const currentContent = editorState.getCurrentContent();
    const currentContentBlock = currentContent.getBlockForKey(anchorKey);
    const start = selectionState.getStartOffset();
    const end = selectionState.getEndOffset();
    const selectedText = currentContentBlock.getText().slice(start, end);
    return selectedText.includes('\n');
}
