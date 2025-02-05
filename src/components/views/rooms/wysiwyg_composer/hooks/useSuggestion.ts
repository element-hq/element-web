/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EMOTICON_TO_EMOJI } from "@matrix-org/emojibase-bindings";
import { type AllowedMentionAttributes, type MappedSuggestion } from "@vector-im/matrix-wysiwyg";
import { type SyntheticEvent, useState, type SetStateAction } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { isNotNull } from "../../../../../Typeguards";

/**
 * Information about the current state of the `useSuggestion` hook.
 */
export type Suggestion = {
    mappedSuggestion: MappedSuggestion;
    /* The information in a `MappedSuggestion` is sufficient to generate a query for the autocomplete
    component but more information is required to allow manipulation of the correct part of the DOM
    when selecting an option from the autocomplete. These three pieces of information allow us to
    do that.
    */
    node: Node;
    startOffset: number;
    endOffset: number;
};
type SuggestionState = Suggestion | null;

/**
 * React hook to allow tracking and replacing of mentions and commands in a div element
 *
 * @param editorRef - a ref to the div that is the composer textbox
 * @param setText - setter function to set the content of the composer
 * @param isAutoReplaceEmojiEnabled - whether plain text emoticons should be auto replaced with emojis
 * @returns
 * - `handleMention`: a function that will insert @ or # mentions which are selected from
 * the autocomplete into the composer, given an href, the text to display, and any additional attributes
 * - `handleCommand`: a function that will replace the content of the composer with the given replacement text.
 * Can be used to process autocomplete of slash commands
 * - `onSelect`: a selection change listener to be attached to the plain text composer
 * - `suggestion`: if the cursor is inside something that could be interpreted as a command or a mention,
 * this will be an object representing that command or mention, otherwise it is null
 */
export function useSuggestion(
    editorRef: React.RefObject<HTMLDivElement>,
    setText: (text?: string) => void,
    isAutoReplaceEmojiEnabled?: boolean,
): {
    handleMention: (href: string, displayName: string, attributes: AllowedMentionAttributes) => void;
    handleAtRoomMention: (attributes: AllowedMentionAttributes) => void;
    handleCommand: (text: string) => void;
    handleEmojiReplacement: () => void;
    onSelect: (event: SyntheticEvent<HTMLDivElement>) => void;
    suggestion: MappedSuggestion | null;
} {
    const [suggestionData, setSuggestionData0] = useState<SuggestionState>(null);

    // debug for https://github.com/vector-im/element-web/issues/26037
    const setSuggestionData = (suggestionData: SetStateAction<SuggestionState>): void => {
        // setState allows either the data itself or a callback which returns the data
        logger.log(
            `## 26037 ## wysiwyg useSuggestion hook setting suggestion data to ${
                suggestionData === null || suggestionData instanceof Function
                    ? suggestionData
                    : suggestionData.mappedSuggestion.keyChar + suggestionData.mappedSuggestion.text
            }`,
        );
        setSuggestionData0(suggestionData);
    };

    // We create a `selectionchange` handler here because we need to know when the user has moved the cursor,
    // we can not depend on input events only
    const onSelect = (): void => processSelectionChange(editorRef, setSuggestionData, isAutoReplaceEmojiEnabled);

    const handleMention = (href: string, displayName: string, attributes: AllowedMentionAttributes): void =>
        processMention(href, displayName, attributes, suggestionData, setSuggestionData, setText);

    const handleAtRoomMention = (attributes: AllowedMentionAttributes): void =>
        processMention("#", "@room", attributes, suggestionData, setSuggestionData, setText);

    const handleCommand = (replacementText: string): void =>
        processCommand(replacementText, suggestionData, setSuggestionData, setText);

    const handleEmojiReplacement = (): void => processEmojiReplacement(suggestionData, setSuggestionData, setText);

    return {
        suggestion: suggestionData?.mappedSuggestion ?? null,
        handleCommand,
        handleMention,
        handleAtRoomMention,
        handleEmojiReplacement,
        onSelect,
    };
}

/**
 * When the selection changes inside the current editor, check to see if the cursor is inside
 * something that could be a command or a mention and update the suggestion state if so
 *
 * @param editorRef - ref to the composer
 * @param setSuggestionData - the setter for the suggestion state
 * @param isAutoReplaceEmojiEnabled - whether plain text emoticons should be auto replaced with emojis
 */
export function processSelectionChange(
    editorRef: React.RefObject<HTMLDivElement>,
    setSuggestionData: React.Dispatch<React.SetStateAction<SuggestionState>>,
    isAutoReplaceEmojiEnabled?: boolean,
): void {
    const selection = document.getSelection();

    // return early if we do not have a current editor ref with a cursor selection inside a text node
    if (
        editorRef.current === null ||
        selection === null ||
        !selection.isCollapsed ||
        selection.anchorNode?.nodeName !== "#text"
    ) {
        setSuggestionData(null);
        return;
    }

    // from here onwards we have a cursor inside a text node
    const { anchorNode: currentNode, anchorOffset: currentOffset } = selection;

    // if we have no text content, return, clearing the suggestion state
    if (currentNode.textContent === null) {
        setSuggestionData(null);
        return;
    }

    const firstTextNode = document.createNodeIterator(editorRef.current, NodeFilter.SHOW_TEXT).nextNode();
    const isFirstTextNode = currentNode === firstTextNode;
    const foundSuggestion = findSuggestionInText(
        currentNode.textContent,
        currentOffset,
        isFirstTextNode,
        isAutoReplaceEmojiEnabled,
    );

    // if we have not found a suggestion, return, clearing the suggestion state
    if (foundSuggestion === null) {
        setSuggestionData(null);
        return;
    }

    setSuggestionData({
        mappedSuggestion: foundSuggestion.mappedSuggestion,
        node: currentNode,
        startOffset: foundSuggestion.startOffset,
        endOffset: foundSuggestion.endOffset,
    });
}

/**
 * Replaces the relevant part of the editor text with a link representing a mention after it
 * is selected from the autocomplete.
 *
 * @param href - the href that the inserted link will use
 * @param displayName - the text content of the link
 * @param attributes - additional attributes to add to the link, can include data-* attributes
 * @param suggestionData - representation of the part of the DOM that will be replaced
 * @param setSuggestionData - setter function to set the suggestion state
 * @param setText - setter function to set the content of the composer
 */
export function processMention(
    href: string,
    displayName: string,
    attributes: AllowedMentionAttributes, // these will be used when formatting the link as a pill
    suggestionData: SuggestionState,
    setSuggestionData: React.Dispatch<React.SetStateAction<SuggestionState>>,
    setText: (text?: string) => void,
): void {
    // if we do not have a suggestion, return early
    if (suggestionData === null) {
        return;
    }

    const { node } = suggestionData;

    // create an <a> element with the required attributes to allow us to interpret the mention as being a pill
    const linkElement = document.createElement("a");
    const linkTextNode = document.createTextNode(displayName);
    linkElement.setAttribute("href", href);
    linkElement.setAttribute("contenteditable", "false");

    for (const [attr, value] of attributes.entries()) {
        linkElement.setAttribute(attr, value);
    }

    linkElement.appendChild(linkTextNode);

    // create text nodes to go before and after the link
    const leadingTextNode = document.createTextNode(node.textContent?.slice(0, suggestionData.startOffset) || "\u200b");
    const trailingTextNode = document.createTextNode(` ${node.textContent?.slice(suggestionData.endOffset) ?? ""}`);

    // now add the leading text node, link element and trailing text node before removing the node we are replacing
    const parentNode = node.parentNode;
    if (isNotNull(parentNode)) {
        parentNode.insertBefore(leadingTextNode, node);
        parentNode.insertBefore(linkElement, node);
        parentNode.insertBefore(trailingTextNode, node);
        parentNode.removeChild(node);
    }

    // move the selection to the trailing text node
    document.getSelection()?.setBaseAndExtent(trailingTextNode, 1, trailingTextNode, 1);

    // set the text content to be the innerHTML of the current editor ref and clear the suggestion state
    setText();
    setSuggestionData(null);
}

/**
 * Replaces the relevant part of the editor text with the replacement text after a command is selected
 * from the autocomplete.
 *
 * @param replacementText - the text that we will insert into the DOM
 * @param suggestionData - representation of the part of the DOM that will be replaced
 * @param setSuggestionData - setter function to set the suggestion state
 * @param setText - setter function to set the content of the composer
 */
export function processCommand(
    replacementText: string,
    suggestionData: SuggestionState,
    setSuggestionData: React.Dispatch<React.SetStateAction<SuggestionState>>,
    setText: (text?: string) => void,
): void {
    // if we do not have a suggestion, return early
    if (suggestionData === null) {
        return;
    }

    const { node } = suggestionData;

    // for a command, we know we start at the beginning of the text node, so build the replacement
    // string (note trailing space) and manually adjust the node's textcontent
    const newContent = `${replacementText} `;
    node.textContent = newContent;

    // then set the cursor to the end of the node, update the `content` state in the usePlainTextListeners
    // hook and clear the suggestion from state
    document.getSelection()?.setBaseAndExtent(node, newContent.length, node, newContent.length);
    setText(newContent);
    setSuggestionData(null);
}

/**
 * Replaces the relevant part of the editor text, replacing the plain text emoitcon with the suggested emoji.
 *
 * @param suggestionData - representation of the part of the DOM that will be replaced
 * @param setSuggestionData - setter function to set the suggestion state
 * @param setText - setter function to set the content of the composer
 */
export function processEmojiReplacement(
    suggestionData: SuggestionState,
    setSuggestionData: React.Dispatch<React.SetStateAction<SuggestionState>>,
    setText: (text?: string) => void,
): void {
    // if we do not have a suggestion of the correct type, return early
    if (suggestionData === null || suggestionData.mappedSuggestion.type !== `custom`) {
        return;
    }
    const { node, mappedSuggestion } = suggestionData;
    const existingContent = node.textContent;

    if (existingContent == null) {
        return;
    }

    // replace the emoticon with the suggesed emoji
    const newContent =
        existingContent.slice(0, suggestionData.startOffset) +
        mappedSuggestion.text +
        existingContent.slice(suggestionData.endOffset);

    node.textContent = newContent;

    document.getSelection()?.setBaseAndExtent(node, newContent.length, node, newContent.length);
    setText(newContent);
    setSuggestionData(null);
}

/**
 * Given some text content from a node and the cursor position, find the word that the cursor is currently inside
 * and then test that word to see if it is a suggestion. Return the `MappedSuggestion` with start and end offsets if
 * the cursor is inside a valid suggestion, null otherwise.
 *
 * @param text - the text content of a node
 * @param offset - the current cursor offset position within the node
 * @param isFirstTextNode - whether or not the node is the first text node in the editor. Used to determine
 * if a command suggestion is found or not
 * @param isAutoReplaceEmojiEnabled - whether plain text emoticons should be auto replaced with emojis
 * @returns the `MappedSuggestion` along with its start and end offsets if found, otherwise null
 */
export function findSuggestionInText(
    text: string,
    offset: number,
    isFirstTextNode: boolean,
    isAutoReplaceEmojiEnabled?: boolean,
): { mappedSuggestion: MappedSuggestion; startOffset: number; endOffset: number } | null {
    // Return null early if the offset is outside the content
    if (offset < 0 || offset > text.length) {
        return null;
    }

    // Variables to keep track of the indices we will be slicing from and to in order to create
    // a substring of the word that the cursor is currently inside
    let startSliceIndex = offset;
    let endSliceIndex = offset;

    // Search backwards from the current cursor position to find the start index of the word
    // containing the cursor
    while (shouldDecrementStartIndex(text, startSliceIndex)) {
        startSliceIndex--;
    }

    // Search forwards from the current cursor position to find the end index of the word
    // containing the cursor
    while (shouldIncrementEndIndex(text, endSliceIndex)) {
        endSliceIndex++;
    }

    // Get the word at the cursor then check if it contains a suggestion or not
    const wordAtCursor = text.slice(startSliceIndex, endSliceIndex);
    const mappedSuggestion = getMappedSuggestion(wordAtCursor, isAutoReplaceEmojiEnabled);

    /**
     * If we have a word that could be a command, it is not a valid command if:
     * - the node we're looking at isn't the first text node in the editor (adding paragraphs can
     *   result in nested <p> tags inside the editor <div>)
     * - the starting index is anything other than 0 (they can only appear at the start of a message)
     * - there is more text following the command (eg `/spo asdf|` should not be interpreted as
     *   something requiring autocomplete)
     */
    if (
        mappedSuggestion === null ||
        (mappedSuggestion.type === "command" &&
            (!isFirstTextNode || startSliceIndex !== 0 || endSliceIndex !== text.length))
    ) {
        return null;
    }

    return { mappedSuggestion, startOffset: startSliceIndex, endOffset: startSliceIndex + wordAtCursor.length };
}

/**
 * Associated function for findSuggestionInText. Checks the character at the preceding index
 * to determine if the search loop should continue.
 *
 * @param text - text content to check for mentions or commands
 * @param index - the current index to check
 * @returns true if check should keep moving backwards, false otherwise
 */
function shouldDecrementStartIndex(text: string, index: number): boolean {
    // If the index is at or outside the beginning of the string, return false
    if (index <= 0) return false;

    // We are inside the string so can guarantee that there is a preceding character
    // Keep searching backwards if the preceding character is not a space
    return !/\s/.test(text[index - 1]);
}

/**
 * Associated function for findSuggestionInText. Checks the character at the current index
 * to determine if the search loop should continue.
 *
 * @param text - text content to check for mentions or commands
 * @param index - the current index to check
 * @returns true if check should keep moving forwards, false otherwise
 */
function shouldIncrementEndIndex(text: string, index: number): boolean {
    // If the index is at or outside the end of the string, return false
    if (index >= text.length) return false;

    // Keep searching forwards if the current character is not a space
    return !/\s/.test(text[index]);
}

/**
 * Given a string, return a `MappedSuggestion` if the string contains a suggestion. Otherwise return null.
 *
 * @param text - string to check for a suggestion
 * @param isAutoReplaceEmojiEnabled - whether plain text emoticons should be auto replaced with emojis
 * @returns a `MappedSuggestion` if a suggestion is present, null otherwise
 */
export function getMappedSuggestion(text: string, isAutoReplaceEmojiEnabled?: boolean): MappedSuggestion | null {
    if (isAutoReplaceEmojiEnabled) {
        // variations of plaintext emoitcons(E.g. :P vs :p vs :-P) are handled upstream by the emojibase-bindings/emojibase libraries.
        // See rules for variations here https://github.com/milesj/emojibase/blob/master/packages/core/src/generateEmoticonPermutations.ts#L3-L32
        const emoji = EMOTICON_TO_EMOJI.get(text);
        if (emoji?.unicode) {
            return { keyChar: "", text: emoji.unicode, type: "custom" };
        }
    }

    const firstChar = text.charAt(0);
    const restOfString = text.slice(1);

    switch (firstChar) {
        case "/":
            return { keyChar: firstChar, text: restOfString, type: "command" };
        case "#":
        case "@":
            return { keyChar: firstChar, text: restOfString, type: "mention" };
        default:
            return null;
    }
}
