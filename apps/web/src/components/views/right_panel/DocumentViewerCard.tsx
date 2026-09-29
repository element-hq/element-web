/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, Suspense, useMemo } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import BaseCard from "./BaseCard";
import ErrorBoundary from "../elements/ErrorBoundary";
import Spinner from "../elements/Spinner";
import { documentMediaForEvent, documentViewerForEvent } from "../../../utils/documentViewer";
import { _t } from "../../../languageHandler";

interface Props {
    mxEvent: MatrixEvent;
    onClose: () => void;
}

/**
 * The right panel card that hosts whichever document viewer can open the event's attachment.
 *
 * The card owns the media handle rather than the viewer, so that re-rendering the panel — which
 * happens on every resize — does not hand the viewer a new `blob` identity and make it reload the file.
 */
export function DocumentViewerCard({ mxEvent, onClose }: Props): JSX.Element | null {
    const viewer = documentViewerForEvent(mxEvent);
    const media = useMemo(() => documentMediaForEvent(mxEvent), [mxEvent]);

    if (!viewer || !media) return null;

    const Viewer = viewer.Component;

    return (
        // Name the card after the file being read; BaseCard ellipsizes a title too long to fit.
        <BaseCard onClose={onClose} header={media.name ?? _t("document_viewer|title")} withoutScrollContainer>
            <ErrorBoundary>
                <Suspense fallback={<Spinner />}>
                    <Viewer media={media} />
                </Suspense>
            </ErrorBoundary>
        </BaseCard>
    );
}
