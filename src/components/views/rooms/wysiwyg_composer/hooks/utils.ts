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

import { MutableRefObject, RefObject } from "react";
import { IEventRelation, MatrixClient } from "matrix-js-sdk/src/matrix";
import { WysiwygEvent } from "@matrix-org/matrix-wysiwyg";

import { TimelineRenderingType } from "../../../../../contexts/RoomContext";
import { IRoomState } from "../../../../structures/RoomView";
import Autocomplete from "../../Autocomplete";
import { getKeyBindingsManager } from "../../../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../../../accessibility/KeyboardShortcuts";
import { getBlobSafeMimeType } from "../../../../../utils/blobs";
import ContentMessages from "../../../../../ContentMessages";
import { isNotNull } from "../../../../../Typeguards";

export function focusComposer(
    composerElement: MutableRefObject<HTMLElement | null>,
    renderingType: TimelineRenderingType,
    roomContext: IRoomState,
    timeoutId: MutableRefObject<number | null>,
): void {
    if (renderingType === roomContext.timelineRenderingType) {
        // Immediately set the focus, so if you start typing it
        // will appear in the composer
        composerElement.current?.focus();
        // If we call focus immediate, the focus _is_ in the right
        // place, but the cursor is invisible, presumably because
        // some other event is still processing.
        // The following line ensures that the cursor is actually
        // visible in composer.
        if (timeoutId.current) {
            clearTimeout(timeoutId.current);
        }
        timeoutId.current = window.setTimeout(() => composerElement.current?.focus(), 200);
    }
}

export function setCursorPositionAtTheEnd(element: HTMLElement): void {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    element.focus();
}

/**
 * When the autocomplete modal is open we need to be able to properly
 * handle events that are dispatched. This allows the user to move the selection
 * in the autocomplete and select using enter.
 *
 * @param autocompleteRef - a ref to the autocomplete of interest
 * @param event - the keyboard event that has been dispatched
 * @returns boolean - whether or not the autocomplete has handled the event
 */
export function handleEventWithAutocomplete(
    autocompleteRef: RefObject<Autocomplete>,
    // we get a React Keyboard event from plain text composer, a Keyboard Event from the rich text composer
    event: KeyboardEvent | React.KeyboardEvent<HTMLDivElement>,
): boolean {
    const autocompleteIsOpen = autocompleteRef?.current && !autocompleteRef.current.state.hide;

    if (!autocompleteIsOpen) {
        return false;
    }

    let handled = false;
    const autocompleteAction = getKeyBindingsManager().getAutocompleteAction(event);
    const component = autocompleteRef.current;

    if (component && component.countCompletions() > 0) {
        switch (autocompleteAction) {
            case KeyBindingAction.ForceCompleteAutocomplete:
            case KeyBindingAction.CompleteAutocomplete:
                autocompleteRef.current.onConfirmCompletion();
                handled = true;
                break;
            case KeyBindingAction.PrevSelectionInAutocomplete:
                autocompleteRef.current.moveSelection(-1);
                handled = true;
                break;
            case KeyBindingAction.NextSelectionInAutocomplete:
                autocompleteRef.current.moveSelection(1);
                handled = true;
                break;
            case KeyBindingAction.CancelAutocomplete:
                autocompleteRef.current.onEscape(event as {} as React.KeyboardEvent);
                handled = true;
                break;
            default:
                break; // don't return anything, allow event to pass through
        }
    }

    if (handled) {
        event.preventDefault();
        event.stopPropagation();
    }

    return handled;
}

/**
 * Takes an event and handles image pasting. Returns a boolean to indicate if it has handled
 * the event or not. Must accept either clipboard or input events in order to prevent issue:
 * https://github.com/vector-im/element-web/issues/25327
 *
 * @param event - event to process
 * @param data - data from the event to process
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

/**
 * Util to determine if an input event or clipboard event must be handled as a clipboard event.
 * Due to https://github.com/vector-im/element-web/issues/25327, certain paste events
 * must be listenened for with an onBeforeInput handler and so will be caught as input events.
 *
 * @param event - the event to test, can be a WysiwygEvent if it comes from the rich text editor, or
 * input or clipboard events if from the plain text editor
 * @returns - true if event should be handled as a clipboard event
 */
export function isEventToHandleAsClipboardEvent(
    event: WysiwygEvent | InputEvent | ClipboardEvent,
): event is InputEvent | ClipboardEvent {
    const isInputEventForClipboard =
        event instanceof InputEvent && event.inputType === "insertFromPaste" && isNotNull(event.dataTransfer);
    const isClipboardEvent = event instanceof ClipboardEvent;

    return isClipboardEvent || isInputEventForClipboard;
}
