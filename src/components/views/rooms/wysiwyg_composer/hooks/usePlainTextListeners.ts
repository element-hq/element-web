/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type KeyboardEvent, type RefObject, type SyntheticEvent, useCallback, useRef, useState } from "react";
import { type AllowedMentionAttributes, type MappedSuggestion } from "@vector-im/matrix-wysiwyg";
import { type IEventRelation } from "matrix-js-sdk/src/matrix";

import { useSettingValue } from "../../../../../hooks/useSettings";
import { IS_MAC, Key } from "../../../../../Keyboard";
import type Autocomplete from "../../Autocomplete";
import { handleClipboardEvent, handleEventWithAutocomplete, isEventToHandleAsClipboardEvent } from "./utils";
import { useSuggestion } from "./useSuggestion";
import { isNotNull, isNotUndefined } from "../../../../../Typeguards";
import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import { useScopedRoomContext } from "../../../../../contexts/ScopedRoomContext.tsx";

function isDivElement(target: EventTarget): target is HTMLDivElement {
    return target instanceof HTMLDivElement;
}

/**
 * React hook which generates all of the listeners and the ref to be attached to the editor.
 *
 * Also returns pieces of state and utility functions that are required for use in other hooks
 * and by the autocomplete component.
 *
 * @param initialContent - the content of the editor when it is first mounted
 * @param onChange - called whenever there is change in the editor content
 * @param onSend - called whenever the user sends the message
 * @param eventRelation - used to send the event to the correct place eg timeline vs thread
 * @param isAutoReplaceEmojiEnabled - whether plain text emoticons should be auto replaced with emojis
 * @returns
 * - `ref`: a ref object which the caller must attach to the HTML `div` node for the editor
 * * `autocompleteRef`: a ref object which the caller must attach to the autocomplete component
 * - `content`: state representing the editor's current text content
 * - `setContent`: the setter function for `content`
 * - `onInput`, `onPaste`, `onKeyDown`: handlers for input, paste and keyDown events
 * - the output from the {@link useSuggestion} hook
 */
export function usePlainTextListeners(
    initialContent?: string,
    onChange?: (content: string) => void,
    onSend?: () => void,
    eventRelation?: IEventRelation,
    isAutoReplaceEmojiEnabled?: boolean,
): {
    ref: RefObject<HTMLDivElement>;
    autocompleteRef: React.RefObject<Autocomplete>;
    content?: string;
    onBeforeInput(event: SyntheticEvent<HTMLDivElement, InputEvent | ClipboardEvent>): void;
    onInput(event: SyntheticEvent<HTMLDivElement, InputEvent | ClipboardEvent>): void;
    onPaste(event: SyntheticEvent<HTMLDivElement, InputEvent | ClipboardEvent>): void;
    onKeyDown(event: KeyboardEvent<HTMLDivElement>): void;
    setContent(text?: string): void;
    handleMention: (link: string, text: string, attributes: AllowedMentionAttributes) => void;
    handleAtRoomMention: (attributes: AllowedMentionAttributes) => void;
    handleCommand: (text: string) => void;
    onSelect: (event: SyntheticEvent<HTMLDivElement>) => void;
    suggestion: MappedSuggestion | null;
} {
    const roomContext = useScopedRoomContext("room", "timelineRenderingType", "replyToEvent");
    const mxClient = useMatrixClientContext();

    const ref = useRef<HTMLDivElement | null>(null);
    const autocompleteRef = useRef<Autocomplete | null>(null);
    const [content, setContent] = useState<string | undefined>(initialContent);

    const send = useCallback(() => {
        if (ref.current) {
            ref.current.innerHTML = "";
        }
        onSend?.();
    }, [ref, onSend]);

    const setText = useCallback(
        (text?: string) => {
            if (isNotUndefined(text)) {
                setContent(text);
                onChange?.(text);
            } else if (isNotNull(ref) && isNotNull(ref.current)) {
                // if called with no argument, read the current innerHTML from the ref and amend it as per `onInput`
                const currentRefContent = ref.current.innerHTML;
                setContent(currentRefContent);
                onChange?.(currentRefContent);
            }
        },
        [onChange, ref],
    );

    // For separation of concerns, the suggestion handling is kept in a separate hook but is
    // nested here because we do need to be able to update the `content` state in this hook
    // when a user selects a suggestion from the autocomplete menu
    const { suggestion, onSelect, handleCommand, handleMention, handleAtRoomMention, handleEmojiReplacement } =
        useSuggestion(ref, setText, isAutoReplaceEmojiEnabled);

    const onInput = useCallback(
        (event: SyntheticEvent<HTMLDivElement, InputEvent | ClipboardEvent>) => {
            if (isDivElement(event.target)) {
                setText(event.target.innerHTML);
            }
        },
        [setText],
    );

    const onPaste = useCallback(
        (event: SyntheticEvent<HTMLDivElement, InputEvent | ClipboardEvent>) => {
            const { nativeEvent } = event;
            let imagePasteWasHandled = false;

            if (isEventToHandleAsClipboardEvent(nativeEvent)) {
                const data =
                    nativeEvent instanceof ClipboardEvent ? nativeEvent.clipboardData : nativeEvent.dataTransfer;
                imagePasteWasHandled = handleClipboardEvent(nativeEvent, data, roomContext, mxClient, eventRelation);
            }

            // prevent default behaviour and skip call to onInput if the image paste event was handled
            if (imagePasteWasHandled) {
                event.preventDefault();
            } else {
                onInput(event);
            }
        },
        [eventRelation, mxClient, onInput, roomContext],
    );

    const enterShouldSend = !useSettingValue("MessageComposerInput.ctrlEnterToSend");
    const onKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            // we need autocomplete to take priority when it is open for using enter to select
            const isHandledByAutocomplete = handleEventWithAutocomplete(autocompleteRef, event);
            if (isHandledByAutocomplete) {
                return;
            }
            // handle accepting of plain text emojicon to emoji replacement
            if (event.key == Key.ENTER || event.key == Key.SPACE) {
                handleEmojiReplacement();
            }

            // resume regular flow
            if (event.key === Key.ENTER) {
                // TODO use getKeyBindingsManager().getMessageComposerAction(event) like in useInputEventProcessor
                const sendModifierIsPressed = IS_MAC ? event.metaKey : event.ctrlKey;

                // if enter should send, send if the user is not pushing shift
                if (enterShouldSend && !event.shiftKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    send();
                }

                // if enter should not send, send only if the user is pushing ctrl/cmd
                if (!enterShouldSend && sendModifierIsPressed) {
                    event.preventDefault();
                    event.stopPropagation();
                    send();
                }
            }
        },
        [autocompleteRef, enterShouldSend, send, handleEmojiReplacement],
    );

    return {
        ref,
        autocompleteRef,
        onBeforeInput: onPaste,
        onInput,
        onPaste,
        onKeyDown,
        content,
        setContent: setText,
        suggestion,
        onSelect,
        handleCommand,
        handleMention,
        handleAtRoomMention,
    };
}
