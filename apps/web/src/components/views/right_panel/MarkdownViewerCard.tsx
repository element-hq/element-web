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
import { markdownMediaForEvent } from "../../../utils/markdownViewer";
import { _t } from "../../../languageHandler";

// The viewer pulls in the Markdown renderer, which is of no use until someone opens a Markdown file, so
// it is code split behind Suspense.
const MarkdownViewer = lazy(() => import("./MarkdownViewer").then((module) => ({ default: module.MarkdownViewer })));

interface Props {
    mxEvent: MatrixEvent;
    onClose: () => void;
}

/**
 * The right panel card that hosts the Markdown viewer.
 *
 * The card owns the media handle rather than the viewer, so that re-rendering the panel — which
 * happens on every resize — does not hand the viewer a new `blob` identity and make it reload the file.
 */
export function MarkdownViewerCard({ mxEvent, onClose }: Props): JSX.Element | null {
    const media = useMemo(() => markdownMediaForEvent(mxEvent), [mxEvent]);

    if (!media) return null;

    return (
        // Name the card after the file being read; BaseCard ellipsizes a title too long to fit.
        <BaseCard onClose={onClose} header={media.name ?? _t("markdown_viewer|title")} withoutScrollContainer>
            <ErrorBoundary>
                <Suspense fallback={<Spinner />}>
                    <MarkdownViewer media={media} />
                </Suspense>
            </ErrorBoundary>
        </BaseCard>
    );
}
