/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Room, type MatrixClient } from "matrix-js-sdk/src/matrix";
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

// ------------------------------------------------------------------
// Hook: useDocumentSync
// ------------------------------------------------------------------
function useDocumentSync(
    room: Room,
    client: MatrixClient,
    composerModel: unknown,
): {
    isLoaded: boolean;
    scheduleDeltaSend: () => void;
} {
    const [isLoaded, setIsLoaded] = useState(false);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Set actor ID to userId:deviceId for correct CRDT attribution.
    useEffect(() => {
        if (!isCollaborative(composerModel)) return;
        const actorId = `${client.getUserId()}:${client.getDeviceId()}`;
        try {
            composerModel.set_actor_id(actorId);
        } catch (e) {
            logger.warn("[DocumentView] Failed to set actor ID", e);
        }
    }, [client, composerModel]);

    // Load the initial document from room state if a snapshot exists.
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
                    logger.info("[DocumentView] Loaded document from room state");
                } catch (e) {
                    logger.warn("[DocumentView] Failed to load document from room state", e);
                }
            }
        }
        setIsLoaded(true);
    }, [room, composerModel]);

    // Apply incoming delta events from the room timeline.
    useEffect(() => {
        if (!isCollaborative(composerModel)) return;

        const onTimeline = (event: import("matrix-js-sdk/src/matrix").MatrixEvent): void => {
            if (event.getRoomId() !== room.roomId) return;
            if (event.getType() !== DOC_DELTA_EVENT_TYPE) return;
            // Skip our own events – the changes are already in the local model.
            if (event.getSender() === client.getUserId()) return;

            const data = event.getContent<{ data?: string }>().data;
            if (!data) return;
            try {
                composerModel.receive_changes(base64Decode(data));
            } catch (e) {
                logger.warn("[DocumentView] Failed to apply remote delta", e);
            }
        };

        // MatrixEvent is fired as "Room.timeline" on the Room object.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        room.on("Room.timeline" as any, onTimeline);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return () => room.off("Room.timeline" as any, onTimeline);
    }, [room, client, composerModel]);

    // Debounced delta send triggered after each keystroke.
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
            } catch (e) {
                logger.warn("[DocumentView] Failed to send delta", e);
            }
        }, DELTA_DEBOUNCE_MS);
    }, [client, composerModel, room.roomId]);

    return { isLoaded, scheduleDeltaSend };
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

    const { isLoaded, scheduleDeltaSend } = useDocumentSync(room, client, composerModel);

    const handleInput = useCallback(() => {
        scheduleDeltaSend();
    }, [scheduleDeltaSend]);

    // Forward clicks anywhere in the content area to the contentEditable.
    // The click may land on the wrapper divs rather than the contentEditable
    // itself, so always ensure the editor has focus after any click in this area.
    const handleContentClick = useCallback(() => {
        ref.current?.focus();
    }, [ref]);

    if (!isLoaded) {
        return <div className="mx_DocumentView mx_DocumentView_loading" />;
    }

    return (
        <ComposerContext.Provider value={composerContext}>
            <div className="mx_DocumentView" data-testid="DocumentView">
                <div className="mx_DocumentView_toolbar">
                    <FormattingButtons composer={wysiwyg} actionStates={actionStates} />
                </div>
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                <div className="mx_DocumentView_content" onInput={handleInput} onClick={handleContentClick}>
                    <Editor ref={ref} disabled={!isWysiwygReady} placeholder="Start typing your document…" />
                </div>
            </div>
        </ComposerContext.Provider>
    );
});
