/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, useMemo } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import BaseCard from "./BaseCard";
import ErrorBoundary from "../elements/ErrorBoundary";
import { PdfViewer } from "./PdfViewer";
import { pdfMediaForEvent } from "../../../utils/pdfViewer";
import { _t } from "../../../languageHandler";

interface Props {
    mxEvent: MatrixEvent;
    onClose: () => void;
}

/**
 * The right panel card that hosts the PDF viewer.
 *
 * The card owns the media handle rather than the viewer, so that re-rendering the panel — which
 * happens on every resize — does not hand the viewer a new `blob` identity and make it reload the
 * document.
 */
export function PdfViewerCard({ mxEvent, onClose }: Props): JSX.Element | null {
    const media = useMemo(() => pdfMediaForEvent(mxEvent), [mxEvent]);

    if (!media) return null;

    return (
        <BaseCard onClose={onClose} header={_t("pdf_viewer|title")} withoutScrollContainer>
            <ErrorBoundary>
                <PdfViewer media={media} />
            </ErrorBoundary>
        </BaseCard>
    );
}
