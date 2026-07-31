/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React, { useEffect, useMemo, useState } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { transcribeAudio } from "../../../features/ai/InferenceClient";
import AccessibleButton from "../elements/AccessibleButton";

interface Props {
    mxEvent: MatrixEvent;
    mediaEventHelper?: MediaEventHelper;
}

type TranscriptionState =
    | { status: "idle" }
    | { status: "loading"; text?: string }
    | { status: "success"; text: string }
    | { status: "error"; error: string; text?: string };

const IDLE_STATE: TranscriptionState = { status: "idle" };
const stateByEventId = new Map<string, TranscriptionState>();
const pendingByEventId = new Map<string, Promise<string>>();
const listeners = new Set<() => void>();

const getTranscriptionId = (event: MatrixEvent): string =>
    event.getId() ?? `local:${event.getTxnId() ?? event.getTs()}`;
const getState = (id: string): TranscriptionState => stateByEventId.get(id) ?? IDLE_STATE;
const setState = (id: string, state: TranscriptionState): void => {
    stateByEventId.set(id, state);
    listeners.forEach((listener) => listener());
};

const AudioTranscription: React.FC<Props> = ({ mxEvent, mediaEventHelper }) => {
    const transcriptionId = getTranscriptionId(mxEvent);
    const [state, setRenderedState] = useState<TranscriptionState>(() => getState(transcriptionId));
    // Some older timeline render paths do not pass a helper to the audio body.
    // Build one lazily here so the action remains available for every playable
    // audio message, including encrypted attachments.
    const fallbackHelper = useMemo(() => new MediaEventHelper(mxEvent), [mxEvent]);
    const helper = mediaEventHelper ?? fallbackHelper;

    useEffect(() => {
        const update = (): void => setRenderedState(getState(transcriptionId));
        update();
        listeners.add(update);
        return () => {
            listeners.delete(update);
        };
    }, [transcriptionId]);

    useEffect(() => () => fallbackHelper.destroy(), [fallbackHelper]);

    const transcribe = (): void => {
        if (pendingByEventId.has(transcriptionId)) return;

        const previous = getState(transcriptionId);
        const previousText = previous.status === "success" || previous.status === "error" ? previous.text : undefined;
        setState(transcriptionId, { status: "loading", text: previousText });

        const request = (async (): Promise<string> => {
            const filename = mxEvent.getContent().body || "audio";
            return transcribeAudio(await helper.sourceBlob.value, filename);
        })();
        pendingByEventId.set(transcriptionId, request);

        request
            .then((text) => setState(transcriptionId, { status: "success", text }))
            .catch((cause: unknown) => {
                const error = cause instanceof Error ? cause.message : "语音转写失败";
                setState(transcriptionId, { status: "error", error, text: previousText });
            })
            .finally(() => pendingByEventId.delete(transcriptionId));
    };

    const actionLabel =
        state.status === "loading"
            ? "转写中"
            : state.status === "success"
              ? "重新转写"
              : state.status === "error"
                ? "重试转写"
                : "转写";

    return (
        <div className="mx_MAudioBody_transcriptionPanel">
            <AccessibleButton
                className="mx_MAudioBody_transcriptionButton"
                data-loading={state.status === "loading" || undefined}
                onClick={transcribe}
                disabled={state.status === "loading"}
            >
                <span className="mx_MAudioBody_transcriptionGlyph" aria-hidden="true">
                    Aa
                </span>
                {actionLabel}
            </AccessibleButton>
            {state.status !== "idle" && (
                <div className="mx_MAudioBody_transcription" aria-live="polite">
                    {state.text && <span className="mx_MAudioBody_transcriptionText">{state.text}</span>}
                    {state.status === "loading" && (
                        <span className="mx_MAudioBody_transcriptionHint">正在识别语音…</span>
                    )}
                    {state.status === "error" && (
                        <span className="mx_MAudioBody_transcriptionError">{state.error}</span>
                    )}
                </div>
            )}
        </div>
    );
};

export default AudioTranscription;
