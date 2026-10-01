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

/** The right panel card hosting the PDF viewer. Owns the media handle so resizes do not reload the document. */
export function PdfViewerCard({ mxEvent, onClose }: Props): JSX.Element | null {
    const media = useMemo(() => pdfMediaForEvent(mxEvent), [mxEvent]);

    if (!media) return null;

    return (
        // Name the card after the file being read; BaseCard ellipsizes a title too long to fit.
        <BaseCard onClose={onClose} header={media.name ?? _t("pdf_viewer|title")} withoutScrollContainer>
            <ErrorBoundary>
                <PdfViewer media={media} />
            </ErrorBoundary>
        </BaseCard>
    );
}
