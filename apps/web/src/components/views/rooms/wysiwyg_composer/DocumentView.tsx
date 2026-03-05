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
import { useDocumentRTC } from "./useDocumentRTC.ts";

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

/**
 * Debounce delay (ms) before sending a delta. Both the MatrixRTC real-time
 * channel and the Matrix timeline persistence channel are triggered by the
 * same debounce so the document is always persisted even if the user exits
 * quickly.
 */
const DELTA_DEBOUNCE_MS = 500;

/** How long (ms) to show the "Saved" indicator before resetting to idle. */
const SAVED_CLEAR_DELAY_MS = 2000;

/** Save a full snapshot to room state every N Matrix timeline deltas. */
const SNAPSHOT_EVERY_N_DELTAS = 20;

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

/** Status shown in the document toolbar reflecting the current save state. */
type SaveStatus = "idle" | "editing" | "saving" | "saved";

function useDocumentSync(
    room: Room,
    client: MatrixClient,
    composerModel: unknown,
    editorRef: React.RefObject<HTMLDivElement | null>,
    onContentChanged: () => void,
    rtc?: {
        publishDelta: (bytes: Uint8Array) => void;
        onDeltaRef: React.MutableRefObject<((bytes: Uint8Array) => void) | null>;
        isConnected: boolean;
    },
): {
    isLoaded: boolean;
    scheduleDeltaSend: () => void;
    suppressMutations: React.MutableRefObject<boolean>;
    saveStatus: SaveStatus;
} {
    const [isLoaded, setIsLoaded] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savedClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    // Load the initial document from the room-state snapshot, then replay
    // any delta timeline events that arrived after the snapshot so we catch
    // up to the latest state even if the snapshot is stale.
    useEffect(() => {
        if (!isCollaborative(composerModel)) {
            setIsLoaded(true);
            return;
        }

        // 1. Load full snapshot from room state (instant, no pagination).
        const stateEvent = room.currentState.getStateEvents(DOC_STATE_EVENT_TYPE, "");
        const snapshotTs = stateEvent?.getTs() ?? 0;
        if (stateEvent) {
            const data = stateEvent.getContent<{ data?: string }>().data;
            if (data) {
                try {
                    composerModel.load_document(base64Decode(data));
                    logger.info("[DocumentView] Loaded snapshot from room state");
                } catch (e) {
                    logger.warn("[DocumentView] Failed to load snapshot from room state", e);
                }
            }
        }

        // 2. Replay delta events from the local timeline that arrived after the
        //    snapshot. receive_changes() is idempotent — re-applying deltas
        //    already included in the snapshot is a harmless no-op.
        const timeline = room.getLiveTimeline().getEvents();
        let appliedDeltas = 0;
        for (const evt of timeline) {
            if (evt.getType() !== DOC_DELTA_EVENT_TYPE) continue;
            // Only replay events newer than the snapshot to reduce work,
            // though idempotency means replaying older ones is safe too.
            if (evt.getTs() <= snapshotTs) continue;
            const data = evt.getContent<{ data?: string }>().data;
            if (!data) continue;
            try {
                composerModel.receive_changes(base64Decode(data));
                appliedDeltas++;
            } catch (e) {
                logger.warn("[DocumentView] Failed to replay delta from timeline", e);
            }
        }
        if (appliedDeltas > 0) {
            logger.info(`[DocumentView] Replayed ${appliedDeltas} delta(s) from timeline`);
        }

        // Flush the incremental save cursor. receive_changes() uses load_incremental()
        // internally which marks the replayed changes as "unsaved". Without this drain
        // call, the first save_incremental() after load would return the entire document
        // history and hit the Matrix 65KB event size limit.
        composerModel.save_incremental();

        // 3. Update the editor DOM to reflect the loaded + replayed state.
        if (editorRef.current) {
            suppressMutations.current = true;
            editorRef.current.innerHTML = composerModel.get_content_as_html();
            requestAnimationFrame(() => { suppressMutations.current = false; });
            onContentChanged();
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

    /** Apply raw Automerge delta bytes to the model and update the DOM. */
    const applyDeltaBytes = useCallback((deltaBytes: Uint8Array): void => {
        const model = composerModelRef.current;
        if (!isCollaborative(model)) {
            logger.warn("[DocumentView] Model not collaborative yet, dropping delta");
            return;
        }
        try {
            model.receive_changes(deltaBytes);
            // Drain the incremental save cursor so that received changes are not
            // re-included in the next save_incremental() call from this client.
            model.save_incremental();
            if (editorRef.current) {
                suppressMutations.current = true;
                const caretOffset = saveCaretOffset(editorRef.current);
                editorRef.current.innerHTML = model.get_content_as_html();
                restoreCaretOffset(editorRef.current, caretOffset);
                requestAnimationFrame(() => { suppressMutations.current = false; });
                onContentChanged();
            }
        } catch (e) {
            logger.warn("[DocumentView] Failed to apply remote delta", e);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorRef, onContentChanged]);

    // Wire the LiveKit onDeltaRef callback when RTC is provided.
    useEffect(() => {
        if (!rtc) return;
        rtc.onDeltaRef.current = applyDeltaBytes;
        return () => { rtc.onDeltaRef.current = null; };
    }, [rtc, applyDeltaBytes]);

    // Always listen for Matrix delta events from remote peers.
    // This runs regardless of whether LiveKit is connected: Matrix events are
    // the durable persistence layer and must always be applied so that users
    // who join later (or reconnect after an outage) see the correct document state.
    useEffect(() => {
        const applyDeltaEvent = (event: import("matrix-js-sdk/src/matrix").MatrixEvent): void => {
            if (event.getRoomId() !== room.roomId) return;
            if (event.getType() !== DOC_DELTA_EVENT_TYPE) return;
            // Skip our own events — local model already has our changes.
            if (event.getSender() === client.getUserId()) return;
            const data = event.getContent<{ data?: string }>().data;
            if (!data) return;
            applyDeltaBytes(base64Decode(data));
        };

        // For unencrypted rooms: events arrive ready on Room.timeline.
        // For encrypted rooms: decrypt fires MatrixEventEvent.Decrypted.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        room.on("Room.timeline" as any, applyDeltaEvent);
        client.on(MatrixEventEvent.Decrypted, applyDeltaEvent);
        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            room.off("Room.timeline" as any, applyDeltaEvent);
            client.off(MatrixEventEvent.Decrypted, applyDeltaEvent);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room, client, applyDeltaBytes]);

    const deltaSendCount = useRef(0);
    const rtcRef = useRef(rtc);
    useEffect(() => { rtcRef.current = rtc; });

    /**
     * Called after every local edit. Immediately surfaces the "Editing"
     * indicator and schedules a 500 ms debounced send to BOTH channels:
     *
     *   1. MatrixRTC / LiveKit (if connected) — real-time collaboration.
     *   2. Matrix room timeline            — durable persistence.
     *
     * Sending to the timeline on every debounce (not just on unmount) ensures
     * the document is never lost even if the user exits quickly.
     */
    const scheduleDeltaSend = useCallback(() => {
        if (!isCollaborative(composerModel)) return;

        // Immediately surface the editing indicator.
        setSaveStatus("editing");
        if (savedClearTimer.current !== null) {
            clearTimeout(savedClearTimer.current);
            savedClearTimer.current = null;
        }

        if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(async () => {
            debounceTimer.current = null;
            if (!isCollaborative(composerModel)) return;
            setSaveStatus("saving");
            try {
                const delta = composerModel.save_incremental();
                if (delta.length === 0) {
                    setSaveStatus("saved");
                    savedClearTimer.current = setTimeout(() => setSaveStatus("idle"), SAVED_CLEAR_DELAY_MS);
                    return;
                }

                const heads = composerModel.get_heads();

                // Real-time channel: deliver immediately to connected peers.
                if (rtcRef.current?.isConnected) {
                    rtcRef.current.publishDelta(delta);
                }

                // Persistence channel: always write to the Matrix timeline so
                // the document survives session boundaries and reconnects.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await client.sendEvent(room.roomId, DOC_DELTA_EVENT_TYPE as any, {
                    data: base64Encode(delta),
                    heads,
                });

                deltaSendCount.current++;

                // Periodically save a full snapshot to speed up future loads.
                if (deltaSendCount.current % SNAPSHOT_EVERY_N_DELTAS === 0) {
                    const snapshot = composerModel.save_document();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await client.sendStateEvent(room.roomId, DOC_STATE_EVENT_TYPE as any, {
                        data: base64Encode(snapshot),
                        heads,
                    });
                    logger.info("[DocumentView] Saved snapshot to room state");
                }

                setSaveStatus("saved");
                savedClearTimer.current = setTimeout(() => setSaveStatus("idle"), SAVED_CLEAR_DELAY_MS);
            } catch (e) {
                logger.warn("[DocumentView] Failed to send delta", e);
                setSaveStatus("idle");
            }
        }, DELTA_DEBOUNCE_MS);
    }, [client, composerModel, room.roomId]);

    // Flush pending delta and save a final snapshot when the document view
    // unmounts (user closes/switches away). This ensures nothing is lost.
    const composerModelRefForCleanup = useRef(composerModel);
    useEffect(() => { composerModelRefForCleanup.current = composerModel; });

    useEffect(() => {
        return () => {
            // Cancel any pending timers.
            if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
            if (savedClearTimer.current !== null) clearTimeout(savedClearTimer.current);

            const model = composerModelRefForCleanup.current;
            if (!isCollaborative(model)) return;
            try {
                const delta = model.save_incremental();
                const snapshot = model.save_document();
                const heads = model.get_heads();
                if (delta.length > 0) {
                    // Fire-and-forget: send final delta.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    client.sendEvent(room.roomId, DOC_DELTA_EVENT_TYPE as any, {
                        data: base64Encode(delta),
                        heads,
                    }).catch((e) => logger.warn("[DocumentView] Failed to send final delta on unmount", e));
                }
                // Always save snapshot on close so next load starts fresh.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                client.sendStateEvent(room.roomId, DOC_STATE_EVENT_TYPE as any, {
                    data: base64Encode(snapshot),
                    heads,
                }).catch((e) => logger.warn("[DocumentView] Failed to save snapshot on unmount", e));
                logger.info("[DocumentView] Flushed delta and saved snapshot on unmount");
            } catch (e) {
                logger.warn("[DocumentView] Error during unmount flush", e);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, room.roomId]);

    return { isLoaded, scheduleDeltaSend, suppressMutations, saveStatus };
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

    // LiveKit real-time transport (falls back gracefully if unavailable).
    const rtc = useDocumentRTC(room, client);

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

    const { isLoaded, scheduleDeltaSend, suppressMutations, saveStatus } = useDocumentSync(
        room,
        client,
        composerModel,
        ref,
        notifyContentChangedRef.current,
        rtc,
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

    // Expose a lightweight diagnostic on `window.__docDebug()` so we can
    // compare CRDT state across clients from the browser console without
    // flooding the log.  Returns a plain object — safe to JSON.stringify.
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__docDebug = () => {
            const model = composerModel;
            const collab = isCollaborative(model);
            const timeline = room.getLiveTimeline().getEvents();
            const deltas = timeline.filter((e) => e.getType() === DOC_DELTA_EVENT_TYPE);
            const stateEvt = room.currentState.getStateEvents(DOC_STATE_EVENT_TYPE, "");

            // Simple hash of a base64 string for quick comparison.
            const simpleHash = (s: string): string => {
                let h = 0;
                for (let i = 0; i < s.length; i++) {
                    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
                }
                return (h >>> 0).toString(16).padStart(8, "0");
            };

            const docBytes = collab ? base64Encode(model.save_document()) : null;
            const info = {
                userId: client.getUserId(),
                deviceId: client.getDeviceId(),
                roomId: room.roomId,
                modelReady: collab,
                rtcConnected: rtc.isConnected,
                heads: collab ? model.get_heads() : null,
                html: collab ? model.get_content_as_html() : null,
                docHash: docBytes ? simpleHash(docBytes) : null,
                docBytesLen: docBytes ? docBytes.length : null,
                domHTML: ref.current?.innerHTML ?? null,
                timelineDeltaCount: deltas.length,
                timelineDeltaSenders: deltas.map((e) => `${e.getSender()} @${e.getTs()}`),
                snapshotTs: stateEvt?.getTs() ?? null,
                snapshotHash: stateEvt?.getContent<{ data?: string }>().data
                    ? simpleHash(stateEvt!.getContent<{ data: string }>().data)
                    : null,
            };
            const json = JSON.stringify(info, null, 2);
            // eslint-disable-next-line no-console
            console.log("[DocDebug]", json);
            // Fallback copy: execCommand works from console unlike clipboard API.
            try {
                const ta = document.createElement("textarea");
                ta.value = json;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                // eslint-disable-next-line no-console
                console.log("[DocDebug] Copied to clipboard ✓");
            } catch { /* ignore */ }
            return info;
        };

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (window as any).__docDebug;
        };
    }, [composerModel, room, client, ref, rtc]);

    // Always render the Editor so that `ref.current` is attached before
    // useComposerModel's effect runs and calls initModel().  The loading
    // overlay only hides the toolbar while the Automerge document is loading.
    return (
        <ComposerContext.Provider value={composerContext}>
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div className="mx_DocumentView" data-testid="DocumentView">
                <div className="mx_DocumentView_toolbar">
                    {isLoaded && <FormattingButtons composer={wysiwyg} actionStates={actionStates} />}
                    {isLoaded && saveStatus !== "idle" && (
                        <span
                            className={`mx_DocumentView_saveStatus mx_DocumentView_saveStatus--${saveStatus}`}
                            aria-live="polite"
                            aria-atomic="true"
                        >
                            {saveStatus === "editing"
                                ? "Editing"
                                : saveStatus === "saving"
                                  ? "Saving\u2026"
                                  : "Saved"}
                        </span>
                    )}
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
