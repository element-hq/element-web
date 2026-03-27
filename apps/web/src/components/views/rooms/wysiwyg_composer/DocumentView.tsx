/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Room, type MatrixClient, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    useWysiwyg,
    renderProjections,
    selectContent,
    type BlockProjection,
} from "@vector-im/matrix-wysiwyg";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext.tsx";
import { FormattingButtons } from "./components/FormattingButtons.tsx";
import { Editor } from "./components/Editor.tsx";
import { ComposerContext, getDefaultContextValue } from "./ComposerContext.ts";
import { useDocumentRTC, type CursorPayload } from "./useDocumentRTC.ts";
import { RemoteCursorOverlay, colorForActor, type RemoteCursor } from "./RemoteCursorOverlay.tsx";

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

/** Minimum time (ms) the "Saving…" indicator stays visible before transitioning to "Saved". */
const SAVING_MIN_DISPLAY_MS = 500;

/** How long (ms) to show the "Saved" indicator before resetting to idle. */
const SAVED_CLEAR_DELAY_MS = 2000;

/** Save a full snapshot to room state every N Matrix timeline deltas. */
const SNAPSHOT_EVERY_N_DELTAS = 20;

/** Throttle interval for broadcasting cursor position changes. */
const CURSOR_THROTTLE_MS = 50;

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
    save_after(heads: string[]): Uint8Array;
    save_document(): Uint8Array;
    load_document(data: Uint8Array): void;
    receive_changes(data: Uint8Array): unknown;
    get_heads(): string[];
    set_actor_id(actor: string): void;
    get_content_as_html(): string;
    get_block_projections(): BlockProjection[];
    selection_start(): number;
    selection_end(): number;
}

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
    committedTextRef: React.MutableRefObject<string>,
    rtc?: {
        publishDelta: (bytes: Uint8Array) => void;
        onDeltaRef: React.MutableRefObject<((bytes: Uint8Array) => void) | null>;
        isConnected: boolean;
    },
): {
    isLoaded: boolean;
    scheduleDeltaSend: () => void;
    saveStatus: SaveStatus;
} {
    const [isLoaded, setIsLoaded] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savedClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Tracks the Automerge heads at the time of the last RTC publish so that
    // save_after() gives exactly the delta since the previous keystroke send.
    const lastRtcHeadsRef = useRef<string[]>([]);

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
        logger.info(`[DocumentView] Load effect running, isCollaborative=${isCollaborative(composerModel)}, model=${composerModel != null}`);
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
        // Seed the RTC heads cursor so the first save_after() on a keystroke
        // captures only the changes made after this load point.
        lastRtcHeadsRef.current = composerModel.get_heads();

        // 3. Update the editor DOM to reflect the loaded + replayed state
        //    using projection-based rendering for correct UTF-16 offset mapping.
        if (editorRef.current) {
            const projections = composerModel.get_block_projections();
            committedTextRef.current = renderProjections(projections, editorRef.current);
        }

        setIsLoaded(true);
    }, [room, composerModel, editorRef, committedTextRef]);

    // Apply incoming delta events from the room timeline and update the DOM.
    // Use a ref for composerModel so the listener closure always has the latest
    // value without needing to re-register on every model change.
    const composerModelRef = useRef(composerModel);
    useEffect(() => {
        composerModelRef.current = composerModel;
    });

    /** Apply raw Automerge delta bytes to the model and update the DOM. */
    const applyDeltaBytes = useCallback((deltaBytes: Uint8Array): void => {
        logger.info(`[DocumentView] applyDeltaBytes called: ${deltaBytes.length}b, model collab=${isCollaborative(composerModelRef.current)}, editor=${Boolean(editorRef.current)}`);
        const model = composerModelRef.current;
        if (!isCollaborative(model)) {
            logger.warn("[DocumentView] Model not collaborative yet, dropping delta");
            return;
        }
        try {
            model.receive_changes(deltaBytes);
            logger.info(`[DocumentView] receive_changes ok, new heads=${JSON.stringify(model.get_heads())}`);
            // Drain the incremental save cursor so that received changes are not
            // re-included in the next save_incremental() call from this client.
            model.save_incremental();
            // Advance the RTC cursor too so the next save_after() on a local
            // keystroke doesn't re-transmit the just-received remote changes.
            lastRtcHeadsRef.current = model.get_heads();
            if (editorRef.current) {
                // Save the model's current selection so we can restore it after
                // re-rendering.  The model selection is kept in sync by
                // useListeners' selectionchange handler.
                const selStart = model.selection_start();
                const selEnd = model.selection_end();

                // Re-render from the model's block projections (same pipeline
                // as useListeners uses for local edits) and keep
                // committedTextRef in sync so reconcileNative() produces
                // correct diffs on the next input event.
                const projections = model.get_block_projections();
                const innerBefore = editorRef.current.innerHTML;
                logger.info(`[DocumentView] renderProjections: ${projections.length} block(s), restoring sel ${selStart}-${selEnd}, innerHTML before=${innerBefore.length}b`);
                committedTextRef.current = renderProjections(projections, editorRef.current);
                const innerAfter = editorRef.current.innerHTML;
                logger.info(`[DocumentView] DOM updated, innerHTML after=${innerAfter.length}b, changed=${innerBefore !== innerAfter}`);

                // Restore the local cursor position.
                selectContent(editorRef.current, selStart, selEnd);
            } else {
                logger.warn("[DocumentView] editorRef.current is null — skipping DOM update");
            }
        } catch (e) {
            logger.warn("[DocumentView] Failed to apply remote delta", e);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorRef, committedTextRef]);

    // Wire the LiveKit onDeltaRef callback when RTC is provided.
    useEffect(() => {
        if (!rtc) return;
        logger.info("[DocumentView] Wiring rtc.onDeltaRef");
        rtc.onDeltaRef.current = applyDeltaBytes;
        return () => { rtc.onDeltaRef.current = null; };
    }, [rtc, applyDeltaBytes]);

    // Always listen for Matrix delta events from remote peers.
    // This runs regardless of whether LiveKit is connected: Matrix events are
    // the durable persistence layer and must always be applied so that users
    // who join later (or reconnect after an outage) see the correct document state.
    useEffect(() => {
        logger.info("[DocumentView] Registering Matrix timeline listener");
        const applyDeltaEvent = (event: import("matrix-js-sdk/src/matrix").MatrixEvent): void => {
            if (event.getRoomId() !== room.roomId) return;
            if (event.getType() !== DOC_DELTA_EVENT_TYPE) return;
            // Skip events sent by this exact device — we already have those
            // changes in our local model.  We must NOT skip events from the same
            // user on a different device (e.g. two tabs open).
            const senderDeviceId = event.getContent<{ device_id?: string }>().device_id;
            if (event.getSender() === client.getUserId() && senderDeviceId === client.getDeviceId()) return;
            const data = event.getContent<{ data?: string }>().data;
            if (!data) return;
            logger.info(`[DocumentView] Matrix delta event from ${event.getSender()}, applying ${data.length}b (base64)`);
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
     * Called after every local edit.
     *
     * Two independent channels run at different cadences:
     *
     *   1. MatrixRTC / LiveKit (if connected) — fires on EVERY call (every
     *      keystroke). Uses save_after(lastRtcHeads) so each publish contains
     *      only the changes since the previous RTC send, giving sub-50 ms
     *      delivery to connected peers.
     *
     *   2. Matrix room timeline — fires after a 500 ms debounce. Uses
     *      save_incremental() which has its own independent cursor, so it
     *      always captures and persists the full batch of changes made during
     *      the quiet period.
     *
     * The two cursors (lastRtcHeadsRef for RTC, internal automerge cursor for
     * Matrix) are entirely independent so neither path affects the other.
     */
    const scheduleDeltaSend = useCallback(() => {
        logger.info(`[DocumentView] scheduleDeltaSend called, isCollaborative=${isCollaborative(composerModel)}`);
        if (!isCollaborative(composerModel)) return;

        // ── Channel 1: RTC — immediate, every keystroke ───────────────────
        const rtc = rtcRef.current;
        logger.info(`[DocumentView] RTC check: rtc=${!!rtc}, isConnected=${rtc?.isConnected}`);
        if (rtc?.isConnected) {
            try {
                const rtcDelta = composerModel.save_after(lastRtcHeadsRef.current);
                logger.info(`[DocumentView] save_after produced ${rtcDelta.length}b delta`);
                if (rtcDelta.length > 0) {
                    rtc.publishDelta(rtcDelta);
                    lastRtcHeadsRef.current = composerModel.get_heads();
                    logger.info(`[DocumentView] Published RTC delta, new heads=${JSON.stringify(lastRtcHeadsRef.current)}`);
                }
            } catch (e) {
                logger.warn("[DocumentView] Failed to publish RTC delta", e);
            }
        }

        // ── Channel 2: Matrix — debounced, persistent ─────────────────────
        logger.info(`[DocumentView] Setting saveStatus → editing, rtcConnected=${rtc?.isConnected}`);
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
            const savingStartedAt = Date.now();

            /** Wait until at least SAVING_MIN_DISPLAY_MS have elapsed since entering "saving". */
            const awaitMinSavingDisplay = (): Promise<void> => {
                const remaining = SAVING_MIN_DISPLAY_MS - (Date.now() - savingStartedAt);
                return remaining > 0 ? new Promise((r) => setTimeout(r, remaining)) : Promise.resolve();
            };

            try {
                const delta = composerModel.save_incremental();
                if (delta.length === 0) {
                    await awaitMinSavingDisplay();
                    setSaveStatus("saved");
                    savedClearTimer.current = setTimeout(() => setSaveStatus("idle"), SAVED_CLEAR_DELAY_MS);
                    return;
                }

                const heads = composerModel.get_heads();

                // Persistence channel: always write to the Matrix timeline so
                // the document survives session boundaries and reconnects.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await client.sendEvent(room.roomId, DOC_DELTA_EVENT_TYPE as any, {
                    data: base64Encode(delta),
                    heads,
                    device_id: client.getDeviceId(),
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

                await awaitMinSavingDisplay();
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
                        device_id: client.getDeviceId(),
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

    return { isLoaded, scheduleDeltaSend, saveStatus };
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

    // useWysiwyg sets up the full input pipeline: useListeners handles input
    // events, feeds them into the Rust model, re-renders via renderProjections,
    // and updates `content` after each model change.  `committedTextRef` tracks
    // the last plain text committed to the editor so reconcileNative() works.
    const { ref, isWysiwygReady, wysiwyg, actionStates, content, composerModel, committedTextRef } =
        useWysiwyg({ isAutoFocusEnabled: true });

    // LiveKit real-time transport (falls back gracefully if unavailable).
    const rtc = useDocumentRTC(room, client);

    // Track whether the editor has content so we can hide the placeholder.
    const [hasContent, setHasContent] = useState(false);

    // Remote cursor state: map of actorId → cursor position + colour.
    const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(() => new Map());
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);

    const { isLoaded, scheduleDeltaSend, saveStatus } = useDocumentSync(
        room,
        client,
        composerModel,
        ref,
        committedTextRef,
        rtc,
    );

    // Trigger Automerge sync whenever useListeners updates `content` (i.e.
    // after every local edit that goes through the model).  This replaces the
    // old manual onInput + MutationObserver approach: the Rust model is now
    // the single source of truth and useListeners keeps it in sync with the DOM.
    const prevContentRef = useRef(content);
    useEffect(() => {
        if (content !== prevContentRef.current) {
            logger.info(`[DocumentView] content changed (len ${content?.length ?? 'null'} ← ${prevContentRef.current?.length ?? 'null'}), isLoaded=${isLoaded}`);
            prevContentRef.current = content;
            setHasContent(Boolean(ref.current?.textContent?.trim()));
            if (isLoaded) {
                scheduleDeltaSend();
            } else {
                logger.warn("[DocumentView] Skipping scheduleDeltaSend — not loaded yet");
            }
        }
    }, [content, isLoaded, scheduleDeltaSend, ref]);

    // Place the cursor at position 0 (document start, like Google Docs) once the
    // WASM model is ready AND the document content has been written to the DOM.
    useEffect(() => {
        if (!isWysiwygReady || !isLoaded || !ref.current) return;
        selectContent(ref.current, 0, 0);
        ref.current.focus();
    }, [isWysiwygReady, isLoaded, ref]);

    // Forward clicks anywhere in the content area to the contentEditable.
    const handleContentClick = useCallback(() => {
        ref.current?.focus();
    }, [ref]);

    // ── Remote cursor sharing ─────────────────────────────────────────────

    // Wire RTC cursor and peer-leave callbacks.
    useEffect(() => {
        rtc.onCursorRef.current = (cursor: CursorPayload): void => {
            setRemoteCursors((prev) => {
                const next = new Map(prev);
                next.set(cursor.id, {
                    anchor: cursor.a,
                    focus: cursor.f,
                    color: colorForActor(cursor.id),
                });
                return next;
            });
        };
        rtc.onPeerLeaveRef.current = (identity: string): void => {
            setRemoteCursors((prev) => {
                if (!prev.has(identity)) return prev;
                const next = new Map(prev);
                next.delete(identity);
                return next;
            });
        };
        return () => {
            rtc.onCursorRef.current = null;
            rtc.onPeerLeaveRef.current = null;
        };
    }, [rtc]);

    // Broadcast the local cursor position on every selectionchange, throttled.
    // Now that useListeners keeps the model selection in sync via
    // composerModel.select(), we can read selection_start/end directly.
    const actorId = useMemo(
        () => toHex(`${client.getUserId()}:${client.getDeviceId()}`),
        [client],
    );

    useEffect(() => {
        if (!isLoaded || !isCollaborative(composerModel)) return;

        let lastSentAt = 0;
        let pending: ReturnType<typeof setTimeout> | null = null;

        const send = (): void => {
            if (!isCollaborative(composerModel)) return;
            const anchor = composerModel.selection_start();
            const focus = composerModel.selection_end();
            rtc.publishCursor(anchor, focus, actorId);
            lastSentAt = Date.now();
        };

        const onSelectionChange = (): void => {
            // Only broadcast when the editor is focused.
            const active = document.activeElement;
            if (!ref.current || !ref.current.contains(active)) return;

            const elapsed = Date.now() - lastSentAt;
            if (elapsed >= CURSOR_THROTTLE_MS) {
                send();
            } else if (!pending) {
                pending = setTimeout(() => {
                    pending = null;
                    send();
                }, CURSOR_THROTTLE_MS - elapsed);
            }
        };

        document.addEventListener("selectionchange", onSelectionChange);
        return () => {
            document.removeEventListener("selectionchange", onSelectionChange);
            if (pending) clearTimeout(pending);
        };
    }, [isLoaded, composerModel, rtc, actorId, ref]);

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

        // Expose a test helper to manually inject a base64-encoded Automerge
        // delta from the browser console.  Useful for confirming that
        // applyDeltaBytes works in isolation (to rule out delivery issues).
        // Usage: window.__docApplyDelta("<base64 delta from __docDebug output>")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__docApplyDelta = (base64: string): void => {
            logger.info("[DocumentView] __docApplyDelta: manual injection", base64.length, "b base64");
            if (rtc.onDeltaRef.current) {
                rtc.onDeltaRef.current(base64Decode(base64));
            } else {
                logger.warn("[DocumentView] __docApplyDelta: onDeltaRef.current is null — check wiring");
            }
        };

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (window as any).__docDebug;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (window as any).__docApplyDelta;
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
                <div
                    className="mx_DocumentView_content"
                    ref={scrollContainerRef}
                    onClick={handleContentClick}
                >
                    <Editor
                        ref={ref}
                        disabled={!isWysiwygReady}
                        placeholder={hasContent ? undefined : "Start typing your document\u2026"}
                    />
                    <RemoteCursorOverlay
                        editorRef={ref}
                        scrollContainerRef={scrollContainerRef}
                        cursors={remoteCursors}
                    />
                </div>
            </div>
        </ComposerContext.Provider>
    );
});
