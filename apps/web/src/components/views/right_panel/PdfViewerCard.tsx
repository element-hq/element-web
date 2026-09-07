/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, lazy, Suspense, useMemo } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import BaseCard from "./BaseCard";
import ErrorBoundary from "../elements/ErrorBoundary";
import Spinner from "../elements/Spinner";
import { pdfMediaForEvent } from "../../../utils/pdfViewer";
import { _t } from "../../../languageHandler";

// The viewer pulls in pdf.js, which is large and of no use until someone actually opens a PDF, so it
// is code split behind Suspense. That also keeps pdf.js out of every module graph that reaches the
// right panel: it is an ES module using `import.meta.url` to locate its worker, which the Jest suites
// cannot parse.
const PdfViewer = lazy(() => import("./PdfViewer").then((module) => ({ default: module.PdfViewer })));

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
                <Suspense fallback={<Spinner />}>
                    <PdfViewer media={media} />
                </Suspense>
            </ErrorBoundary>
        </BaseCard>
    );
}
