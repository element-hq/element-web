/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React, { useState } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { recogniseImage } from "../../../features/ai/InferenceClient";
import AccessibleButton from "./AccessibleButton";

interface Props {
    mxEvent: MatrixEvent;
}

/** OCR is deliberately a lightbox child so it survives virtual timeline item disposal. */
const ImageOcrPanel: React.FC<Props> = ({ mxEvent }) => {
    const [busy, setBusy] = useState(false);
    const [text, setText] = useState<string>();
    const [error, setError] = useState<string>();

    const run = async (): Promise<void> => {
        setBusy(true);
        setError(undefined);
        const helper = new MediaEventHelper(mxEvent);
        try {
            setText(await recogniseImage(await helper.sourceBlob.value));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "图片识别失败");
        } finally {
            helper.destroy();
            setBusy(false);
        }
    };

    return (
        <>
            <AccessibleButton className="mx_ImageView_button" title="OCR" onClick={run} disabled={busy}>
                OCR
            </AccessibleButton>
            {(text || error) && (
                <aside className="mx_ImageOcrPanel" aria-live="polite">
                    {error || text}
                </aside>
            )}
        </>
    );
};

export default ImageOcrPanel;
