/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Room, type MatrixClient, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { useWysiwyg, type UseWysiwyg } from "@vector-im/matrix-wysiwyg";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext.tsx";
import { FormattingButtons } from "./components/FormattingButtons.tsx";
import { Editor } from "./components/Editor.tsx";
import { ComposerContext, getDefaultContextValue } from "./ComposerContext.ts";
import { useSetCursorPosition } from "./hooks/useSetCursorPosition.ts";

/**
 * Matrix event type for incremental Automerge deltas sent as timeline events.
 * Content: { data: string (base64), heads: string[] }
 */
const DOC_DELTA_EVENT_TYPE = "org.element.doc.delta";

/**
 * Matrix room-state key for the full Automerge document snapshot.
 * Content: { data: string (base64) }
 */
const DOC_STATE_EVENT_TYPE = "org.element.doc.automerge";

/** Debounce delay (ms) before sending an incremental delta after a keystroke. */
const DELTA_DEBOUNCE_MS = 500;

// ------------------------------------------------------------------
// Collaboration type augmentation
//
// @vector-im/matrix-wysiwyg 2.40.0 does not yet expose the Automerge
// collaboration methods.  We define the extended interfaces here so
// element-web can use them once the package is updated.  At runtime
// isCollaborative() guards all calls.
// ------------------------------------------------------------------
interface CollaborativeComposerModel {
    save_incremental(): Uint8Array;
    save_document(): Uint8Array;
    load_document(data: Uint8Array): void;
    receive_changes(data: Uint8Array): unknown;
    get_heads(): string[];
    set_actor_id(actor: string): void;
    get_content_as_html(): string;
}

/**
 * UseWysiwyg extended with the composerModel field exposed in langleyd/automerge.
 * The npm-published 2.40.0 package does not include this field; we use an
 * intersection type + runtime cast so code is forward-compatible.
 */
type UseWysiwygExtended = UseWysiwyg & {
    composerModel?: unknown;
};

function isCollaborative(model: unknown): model is CollaborativeComposerModel {
    return typeof (model as CollaborativeComposerModel | null)?.save_incremental === "function";
}

function base64Encode(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64Decode(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Save the caret position as a character offset from the start of the
 * editor's text content. Returns -1 if there is no selection.
 */
function saveCaretOffset(editor: HTMLElement): number {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return -1;
    const range = sel.getRangeAt(0).cloneRange();
    range.selectNodeContents(editor);
    range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
    return range.toString().length;
}

/**
 * Restore a caret position (character offset) inside the editor after an
 * innerHTML replacement. Walks text nodes to find the right position.
 */
function restoreCaretOffset(editor: HTMLElement, offset: number): void {
    if (offset < 0) return;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node: Text | null = null;
    let nodeOffset = 0;
    while (walker.nextNode()) {
        const text = walker.currentNode as Text;
        if (text.length >= remaining) {
            node = text;
            nodeOffset = remaining;
            break;
        }
        remaining -= text.length;
    }
    if (!node && editor.lastChild) {
        // offset past end — place at end
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        return;
    }
    if (node) {
        const range = document.createRange();
        range.setStart(node, nodeOffset);
        range.collapse(true);
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }
}

/**
 * Encode a UTF-8 string as a lowercase hex string, as required by
 * the Automerge `set_actor_id` API.
 */
function toHex(str: string): string {
    return Array.from(new TextEncoder().encode(str))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

// ------------------------------------------------------------------
// Hook: useDocumentSync
// ------------------------------------------------------------------
function useDocumentSync(
    room: Room,
    client: MatrixClient,
    composerModel: unknown,
    editorRef: React.RefObject<HTMLDivElement | null>,
    onContentChanged: () => void,
): {
    isLoaded: boolean;
    scheduleDeltaSend: () => void;
    suppressMutations: React.MutableRefObject<boolean>;
} {
    const [isLoaded, setIsLoaded] = useState(false);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suppressMutations = useRef(false);

    // Set actor ID as hex-encoded userId:deviceId for correct CRDT attribution.
    // set_actor_id() requires a hex string (decoded to raw bytes internally).
    useEffect(() => {
        if (!isCollaborative(composerModel)) return;
        const actorId = toHex(`${client.getUserId()}:${client.getDeviceId()}`);
        try {
            composerModel.set_actor_id(actorId);
        } catch (e) {
            logger.warn("[DocumentView] Failed to set actor ID", e);
        }
    }, [client, composerModel]);

    // Load the initial document from room state if a snapshot exists,
    // then update the editor DOM to reflect the loaded content.
    useEffect(() => {
        if (!isCollaborative(composerModel)) {
            setIsLoaded(true);
            return;
        }

        const stateEvent = room.currentState.getStateEvents(DOC_STATE_EVENT_TYPE, "");
        if (stateEvent) {
            const data = stateEvent.getContent<{ data?: string }>().data;
            if (data) {
                try {
                    composerModel.load_document(base64Decode(data));
                    // Reflect the loaded document in the editor DOM.
                    if (editorRef.current) {
                        suppressMutations.current = true;
                        editorRef.current.innerHTML = composerModel.get_content_as_html();
                        suppressMutations.current = false;
                        onContentChanged();
                    }
                    logger.info("[DocumentView] Loaded document from room state");
                } catch (e) {
                    logger.warn("[DocumentView] Failed to load document from room state", e);
                }
            }
        }
        setIsLoaded(true);
    }, [room, composerModel, editorRef, onContentChanged]);

    // Apply incoming delta events from the room timeline and update the DOM.
    // Use a ref for composerModel so the listener closure always has the latest
    // value without needing to re-register on every model change.
    const composerModelRef = useRef(composerModel);
    useEffect(() => {
        composerModelRef.current = composerModel;
    });

    useEffect(() => {
        logger.info("[DocumentView] Registering delta listeners for room", room.roomId);

        const applyDeltaEvent = (event: import("matrix-js-sdk/src/matrix").MatrixEvent): void => {
            if (event.getRoomId() !== room.roomId) return;
            if (event.getType() !== DOC_DELTA_EVENT_TYPE) return;

            const eventDeviceId = event.getUnsigned()?.["device_id"] as string | undefined;
            if (event.getSender() === client.getUserId() && eventDeviceId === client.getDeviceId()) return;

            const model = composerModelRef.current;
            if (!isCollaborative(model)) { logger.warn("[DocumentView] Model not collaborative yet, dropping delta"); return; }

            const data = event.getContent<{ data?: string }>().data;
            if (!data) { logger.warn("[DocumentView] Delta event has no data"); return; }
            try {
                model.receive_changes(base64Decode(data));
                if (editorRef.current) {
                    suppressMutations.current = true;
                    const caretOffset = saveCaretOffset(editorRef.current);
                    editorRef.current.innerHTML = model.get_content_as_html();
                    restoreCaretOffset(editorRef.current, caretOffset);
                    suppressMutations.current = false;
                    onContentChanged();
                }
                logger.info("[DocumentView] Applied remote delta successfully");
            } catch (e) {
                logger.warn("[DocumentView] Failed to apply remote delta", e);
            }
        };

        // For unencrypted rooms: events arrive ready to use on Room.timeline.
        // For encrypted rooms: events arrive as m.room.encrypted on Room.timeline
        // and are only usable after MatrixEventEvent.Decrypted fires on the client.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        room.on("Room.timeline" as any, applyDeltaEvent);
        client.on(MatrixEventEvent.Decrypted, applyDeltaEvent);

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            room.off("Room.timeline" as any, applyDeltaEvent);
            client.off(MatrixEventEvent.Decrypted, applyDeltaEvent);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room, client, editorRef, onContentChanged]);

    // Debounced delta send triggered after each keystroke.
    // Also saves a full snapshot to room state so the document persists on refresh.
    const scheduleDeltaSend = useCallback(() => {
        if (!isCollaborative(composerModel)) return;

        if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(async () => {
            debounceTimer.current = null;
            if (!isCollaborative(composerModel)) return;
            try {
                const delta = composerModel.save_incremental();
                if (delta.length === 0) return; // Nothing new to send.

                const heads = composerModel.get_heads();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await client.sendEvent(room.roomId, DOC_DELTA_EVENT_TYPE as any, {
                    data: base64Encode(delta),
                    heads,
                });

                // Persist a full snapshot to room state so the document survives refresh.
                const snapshot = composerModel.save_document();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await client.sendStateEvent(room.roomId, DOC_STATE_EVENT_TYPE as any, {
                    data: base64Encode(snapshot),
                });
            } catch (e) {
                logger.warn("[DocumentView] Failed to send delta", e);
            }
        }, DELTA_DEBOUNCE_MS);
    }, [client, composerModel, room.roomId]);

    return { isLoaded, scheduleDeltaSend, suppressMutations };
}

// ------------------------------------------------------------------
// DocumentView component
// ------------------------------------------------------------------

interface DocumentViewProps {
    room: Room;
}

export const DocumentView = memo(function DocumentView({ room }: DocumentViewProps) {
    const client = useMatrixClientContext();

    // ComposerContext is required by the Editor's useSelection hook.
    const composerContext = useMemo(() => getDefaultContextValue(), []);

    // Cast to the extended type to access composerModel when available (requires
    // @vector-im/matrix-wysiwyg >= langleyd/automerge build).
    const wysiwygResult = useWysiwyg({ isAutoFocusEnabled: true }) as UseWysiwygExtended;
    const { ref, isWysiwygReady, wysiwyg, actionStates } = wysiwygResult;
    const composerModel = wysiwygResult.composerModel;

    // Place the cursor at the end and focus the editor once the WASM model is
    // ready.  Without this the editor is enabled but has no selection, so no
    // cursor appears even after the element receives focus.
    useSetCursorPosition(!isWysiwygReady, ref);

    // Track whether the editor has content so we can hide the placeholder.
    const [hasContent, setHasContent] = useState(false);

    // Stable callback ref so useDocumentSync doesn't re-register its listener
    // every time the component re-renders.
    const notifyContentChangedRef = useRef(() => {
        setHasContent(Boolean(ref.current?.textContent?.trim()));
    });

    const { isLoaded, scheduleDeltaSend, suppressMutations } = useDocumentSync(
        room,
        client,
        composerModel,
        ref,
        notifyContentChangedRef.current,
    );

    const handleInput = useCallback(() => {
        notifyContentChangedRef.current();
        scheduleDeltaSend();
    }, [scheduleDeltaSend]);

    // MutationObserver to catch formatting/structural changes that don't
    // fire onInput (e.g. bold, italic applied via the toolbar).
    const scheduleDeltaSendRef = useRef(scheduleDeltaSend);
    useEffect(() => { scheduleDeltaSendRef.current = scheduleDeltaSend; }, [scheduleDeltaSend]);

    useEffect(() => {
        if (!ref.current) return;
        const observer = new MutationObserver(() => {
            if (suppressMutations.current) return;
            scheduleDeltaSendRef.current();
            notifyContentChangedRef.current();
        });
        observer.observe(ref.current, { childList: true, subtree: true, characterData: true, attributes: true });
        return () => observer.disconnect();
    }, [ref, isWysiwygReady, suppressMutations]); // re-attach after editor becomes enabled

    // Forward clicks anywhere in the content area to the contentEditable.
    const handleContentClick = useCallback(() => {
        ref.current?.focus();
    }, [ref]);

    // Always render the Editor so that `ref.current` is attached before
    // useComposerModel's effect runs and calls initModel().  The loading
    // overlay only hides the toolbar while the Automerge document is loading.
    return (
        <ComposerContext.Provider value={composerContext}>
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div className="mx_DocumentView" data-testid="DocumentView">
                <div className="mx_DocumentView_toolbar">
                    {isLoaded && <FormattingButtons composer={wysiwyg} actionStates={actionStates} />}
                </div>
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                <div className="mx_DocumentView_content" onInput={handleInput} onClick={handleContentClick}>
                    <Editor
                        ref={ref}
                        disabled={!isWysiwygReady}
                        placeholder={hasContent ? undefined : "Start typing your document…"}
                    />
                </div>
            </div>
        </ComposerContext.Provider>
    );
});
