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

import { Wysiwyg, WysiwygEvent } from "@matrix-org/matrix-wysiwyg";
import { useCallback } from "react";
import { IEventRelation, MatrixClient } from "matrix-js-sdk/src/matrix";

import { useSettingValue } from "../../../../../hooks/useSettings";
import { getKeyBindingsManager } from "../../../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../../../accessibility/KeyboardShortcuts";
import { findEditableEvent } from "../../../../../utils/EventUtils";
import dis from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import { useRoomContext } from "../../../../../contexts/RoomContext";
import { IRoomState } from "../../../../structures/RoomView";
import { ComposerContextState, useComposerContext } from "../ComposerContext";
import EditorStateTransfer from "../../../../../utils/EditorStateTransfer";
import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import { isCaretAtEnd, isCaretAtStart } from "../utils/selection";
import { getEventsFromEditorStateTransfer, getEventsFromRoom } from "../utils/event";
import { endEditing } from "../utils/editing";
import Autocomplete from "../../Autocomplete";
import { handleEventWithAutocomplete } from "./utils";
import ContentMessages from "../../../../../ContentMessages";
import { getBlobSafeMimeType } from "../../../../../utils/blobs";
import { isNotNull } from "../../../../../Typeguards";

export function useInputEventProcessor(
    onSend: () => void,
    autocompleteRef: React.RefObject<Autocomplete>,
    initialContent?: string,
    eventRelation?: IEventRelation,
): (event: WysiwygEvent, composer: Wysiwyg, editor: HTMLElement) => WysiwygEvent | null {
    const roomContext = useRoomContext();
    const composerContext = useComposerContext();
    const mxClient = useMatrixClientContext();
    const isCtrlEnterToSend = useSettingValue<boolean>("MessageComposerInput.ctrlEnterToSend");

    return useCallback(
        (event: WysiwygEvent, composer: Wysiwyg, editor: HTMLElement) => {
            const send = (): void => {
                event.stopPropagation?.();
                event.preventDefault?.();
                // do not send the message if we have the autocomplete open, regardless of settings
                if (autocompleteRef?.current && !autocompleteRef.current.state.hide) {
                    return;
                }
                onSend();
            };

            // this is required to handle edge case image pasting in Safari, see
            // https://github.com/vector-im/element-web/issues/25327 and it is caught by the
            // `beforeinput` listener attached to the composer
            const isInputEventForClipboard =
                event instanceof InputEvent && event.inputType === "insertFromPaste" && isNotNull(event.dataTransfer);
            const isClipboardEvent = event instanceof ClipboardEvent;

            const shouldHandleAsClipboardEvent = isClipboardEvent || isInputEventForClipboard;

            if (shouldHandleAsClipboardEvent) {
                const data = isClipboardEvent ? event.clipboardData : event.dataTransfer;
                const handled = handleClipboardEvent(event, data, roomContext, mxClient, eventRelation);
                return handled ? null : event;
            }

            const isKeyboardEvent = event instanceof KeyboardEvent;
            if (isKeyboardEvent) {
                return handleKeyboardEvent(
                    event,
                    send,
                    initialContent,
                    composer,
                    editor,
                    roomContext,
                    composerContext,
                    mxClient,
                    autocompleteRef,
                );
            } else {
                return handleInputEvent(event, send, isCtrlEnterToSend);
            }
        },
        [
            isCtrlEnterToSend,
            onSend,
            initialContent,
            roomContext,
            composerContext,
            mxClient,
            autocompleteRef,
            eventRelation,
        ],
    );
}

type Send = () => void;

function handleKeyboardEvent(
    event: KeyboardEvent,
    send: Send,
    initialContent: string | undefined,
    composer: Wysiwyg,
    editor: HTMLElement,
    roomContext: IRoomState,
    composerContext: ComposerContextState,
    mxClient: MatrixClient | undefined,
    autocompleteRef: React.RefObject<Autocomplete>,
): KeyboardEvent | null {
    const { editorStateTransfer } = composerContext;
    const isEditing = Boolean(editorStateTransfer);
    const isEditorModified = isEditing ? initialContent !== composer.content() : composer.content().length !== 0;
    const action = getKeyBindingsManager().getMessageComposerAction(event);

    // we need autocomplete to take priority when it is open for using enter to select
    const isHandledByAutocomplete = handleEventWithAutocomplete(autocompleteRef, event);
    if (isHandledByAutocomplete) {
        return event;
    }

    // taking the client from context gives us an client | undefined type, narrow it down
    if (mxClient === undefined) {
        return null;
    }

    switch (action) {
        case KeyBindingAction.SendMessage:
            send();
            return null;
        case KeyBindingAction.EditPrevMessage: {
            // Or if the caret is not at the beginning of the editor
            // Or the editor is modified
            if (!isCaretAtStart(editor) || isEditorModified) {
                break;
            }

            const isDispatched = dispatchEditEvent(
                event,
                false,
                editorStateTransfer,
                composerContext,
                roomContext,
                mxClient,
            );

            if (isDispatched) {
                return null;
            }

            break;
        }
        case KeyBindingAction.EditNextMessage: {
            // If not in edition
            // Or if the caret is not at the end of the editor
            // Or the editor is modified
            if (!editorStateTransfer || !isCaretAtEnd(editor) || isEditorModified) {
                break;
            }

            const isDispatched = dispatchEditEvent(
                event,
                true,
                editorStateTransfer,
                composerContext,
                roomContext,
                mxClient,
            );
            if (!isDispatched) {
                endEditing(roomContext);
                event.preventDefault();
                event.stopPropagation();
            }

            return null;
        }
    }

    return event;
}

function dispatchEditEvent(
    event: KeyboardEvent,
    isForward: boolean,
    editorStateTransfer: EditorStateTransfer | undefined,
    composerContext: ComposerContextState,
    roomContext: IRoomState,
    mxClient: MatrixClient,
): boolean {
    const foundEvents = editorStateTransfer
        ? getEventsFromEditorStateTransfer(editorStateTransfer, roomContext, mxClient)
        : getEventsFromRoom(composerContext, roomContext);
    if (!foundEvents) {
        return false;
    }

    const newEvent = findEditableEvent({
        events: foundEvents,
        isForward,
        fromEventId: editorStateTransfer?.getEvent().getId(),
        matrixClient: mxClient,
    });
    if (newEvent) {
        dis.dispatch({
            action: Action.EditEvent,
            event: newEvent,
            timelineRenderingType: roomContext.timelineRenderingType,
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    }
    return false;
}

type InputEvent = Exclude<WysiwygEvent, KeyboardEvent | ClipboardEvent>;

function handleInputEvent(event: InputEvent, send: Send, isCtrlEnterToSend: boolean): InputEvent | null {
    switch (event.inputType) {
        case "insertParagraph":
            if (!isCtrlEnterToSend) {
                send();
                return null;
            }
            break;
        case "sendMessage":
            if (isCtrlEnterToSend) {
                send();
                return null;
            }
            break;
    }

    return event;
}

/**
 * Takes an event and handles image pasting. Returns a boolean to indicate if it has handled
 * the event or not. Must accept either clipboard or input events in order to prevent issue:
 * https://github.com/vector-im/element-web/issues/25327
 *
 * @param event - event to process
 * @param roomContext - room in which the event occurs
 * @param mxClient - current matrix client
 * @param eventRelation - used to send the event to the correct place eg timeline vs thread
 * @returns - boolean to show if the event was handled or not
 */
export function handleClipboardEvent(
    event: ClipboardEvent | InputEvent,
    data: DataTransfer | null,
    roomContext: IRoomState,
    mxClient: MatrixClient,
    eventRelation?: IEventRelation,
): boolean {
    // Logic in this function follows that of `SendMessageComposer.onPaste`
    const { room, timelineRenderingType, replyToEvent } = roomContext;

    function handleError(error: unknown): void {
        if (error instanceof Error) {
            console.log(error.message);
        } else if (typeof error === "string") {
            console.log(error);
        }
    }

    if (event.type !== "paste" || data === null || room === undefined) {
        return false;
    }

    // Prioritize text on the clipboard over files if RTF is present as Office on macOS puts a bitmap
    // in the clipboard as well as the content being copied. Modern versions of Office seem to not do this anymore.
    // We check text/rtf instead of text/plain as when copy+pasting a file from Finder or Gnome Image Viewer
    // it puts the filename in as text/plain which we want to ignore.
    if (data.files.length && !data.types.includes("text/rtf")) {
        ContentMessages.sharedInstance()
            .sendContentListToRoom(Array.from(data.files), room.roomId, eventRelation, mxClient, timelineRenderingType)
            .catch(handleError);
        return true;
    }

    // Safari `Insert from iPhone or iPad`
    // data.getData("text/html") returns a string like: <img src="blob:https://...">
    if (data.types.includes("text/html")) {
        const imgElementStr = data.getData("text/html");
        const parser = new DOMParser();
        const imgDoc = parser.parseFromString(imgElementStr, "text/html");

        if (
            imgDoc.getElementsByTagName("img").length !== 1 ||
            !imgDoc.querySelector("img")?.src.startsWith("blob:") ||
            imgDoc.childNodes.length !== 1
        ) {
            handleError("Failed to handle pasted content as Safari inserted content");
            return false;
        }
        const imgSrc = imgDoc.querySelector("img")!.src;

        fetch(imgSrc)
            .then((response) => {
                response
                    .blob()
                    .then((imgBlob) => {
                        const type = imgBlob.type;
                        const safetype = getBlobSafeMimeType(type);
                        const ext = type.split("/")[1];
                        const parts = response.url.split("/");
                        const filename = parts[parts.length - 1];
                        const file = new File([imgBlob], filename + "." + ext, { type: safetype });
                        ContentMessages.sharedInstance()
                            .sendContentToRoom(file, room.roomId, eventRelation, mxClient, replyToEvent)
                            .catch(handleError);
                    })
                    .catch(handleError);
            })
            .catch(handleError);
        return true;
    }

    return false;
}
