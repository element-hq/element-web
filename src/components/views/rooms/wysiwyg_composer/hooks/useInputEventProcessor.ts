/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Wysiwyg, type WysiwygEvent } from "@vector-im/matrix-wysiwyg";
import { useCallback } from "react";
import { type IEventRelation, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { useSettingValue } from "../../../../../hooks/useSettings";
import { getKeyBindingsManager } from "../../../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../../../accessibility/KeyboardShortcuts";
import { findEditableEvent } from "../../../../../utils/EventUtils";
import dis from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import { type IRoomState } from "../../../../structures/RoomView";
import { type ComposerContextState, useComposerContext } from "../ComposerContext";
import type EditorStateTransfer from "../../../../../utils/EditorStateTransfer";
import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import { isCaretAtEnd, isCaretAtStart } from "../utils/selection";
import { getEventsFromEditorStateTransfer, getEventsFromRoom } from "../utils/event";
import { endEditing } from "../utils/editing";
import type Autocomplete from "../../Autocomplete";
import { handleClipboardEvent, handleEventWithAutocomplete, isEventToHandleAsClipboardEvent } from "./utils";
import { useScopedRoomContext } from "../../../../../contexts/ScopedRoomContext.tsx";

export function useInputEventProcessor(
    onSend: () => void,
    autocompleteRef: React.RefObject<Autocomplete>,
    initialContent?: string,
    eventRelation?: IEventRelation,
): (event: WysiwygEvent, composer: Wysiwyg, editor: HTMLElement) => WysiwygEvent | null {
    const roomContext = useScopedRoomContext("liveTimeline", "room", "replyToEvent", "timelineRenderingType");
    const composerContext = useComposerContext();
    const mxClient = useMatrixClientContext();
    const isCtrlEnterToSend = useSettingValue("MessageComposerInput.ctrlEnterToSend");

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

            if (isEventToHandleAsClipboardEvent(event)) {
                const data = event instanceof ClipboardEvent ? event.clipboardData : event.dataTransfer;
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
    roomContext: Pick<IRoomState, "liveTimeline" | "timelineRenderingType" | "room">,
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
    roomContext: Pick<IRoomState, "liveTimeline" | "timelineRenderingType" | "room">,
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
