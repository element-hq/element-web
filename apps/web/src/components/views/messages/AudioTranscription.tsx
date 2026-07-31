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

const AudioTranscription: React.FC<Props> = ({ mxEvent, mediaEventHelper }) => {
    const [busy, setBusy] = useState(false);
    const [text, setText] = useState<string>();
    const [error, setError] = useState<string>();
    // Some older timeline render paths do not pass a helper to the audio body.
    // Build one lazily here so the transcribe action remains available for every
    // playable voice/audio message, including encrypted media.
    const fallbackHelper = useMemo(() => new MediaEventHelper(mxEvent), [mxEvent]);
    const helper = mediaEventHelper ?? fallbackHelper;
    useEffect(() => () => fallbackHelper.destroy(), [fallbackHelper]);
    const transcribe = async (): Promise<void> => {
        setBusy(true);
        setError(undefined);
        try {
            const filename = mxEvent.getContent().body || "audio";
            setText(await transcribeAudio(await helper.sourceBlob.value, filename));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "语音转文字失败");
        } finally {
            setBusy(false);
        }
    };
    return (
        <>
            <AccessibleButton className="mx_MAudioBody_transcriptionButton" onClick={transcribe} disabled={busy}>
                {busy ? "Aa 正在转写…" : "Aa 转写"}
            </AccessibleButton>
            {(text || error) && <span className="mx_MAudioBody_transcription">{error || text}</span>}
        </>
    );
};

export default AudioTranscription;
