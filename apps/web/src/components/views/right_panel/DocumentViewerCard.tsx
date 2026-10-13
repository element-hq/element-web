/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, Suspense, useMemo } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { DocumentViewerView } from "@element-hq/web-shared-components";

import BaseCard from "./BaseCard";
import ErrorBoundary from "../elements/ErrorBoundary";
import Spinner from "../elements/Spinner";
import {
    documentMediaForEvent,
    documentMediaForFile,
    documentViewerForEvent,
    documentViewerForFile,
} from "../../../utils/documentViewer";
import { _t } from "../../../languageHandler";
import { type DocumentFile } from "../../../@types/document-viewer";

interface Props {
    /** The event whose attachment to show. Takes precedence over `file`. */
    mxEvent?: MatrixEvent;
    /** A file that does not come from an event, shown when there is no `mxEvent`. */
    file?: DocumentFile;
    onClose: () => void;
}

/**
 * The right panel card that hosts whichever document viewer can open the event's attachment or the file.
 *
 * The card owns the media handle rather than the viewer, so that re-rendering the panel — which
 * happens on every resize — does not hand the viewer a new `blob` identity and make it reload the file.
 */
export function DocumentViewerCard({ mxEvent, file, onClose }: Props): JSX.Element {
    const viewer = useMemo(
        () => (mxEvent ? documentViewerForEvent(mxEvent) : file && documentViewerForFile(file)),
        [mxEvent, file],
    );
    const media = useMemo(
        () => (mxEvent ? documentMediaForEvent(mxEvent) : file && documentMediaForFile(file)),
        [mxEvent, file],
    );

    // The store only opens the card for an event a viewer can handle, but the event can stop being
    // one while the card is open, e.g. when the attachment is redacted. A file can also have a mimetype
    // no viewer handles. Show the error rather than an empty panel, so the card can still be closed.
    if (!viewer || !media) {
        return (
            <BaseCard onClose={onClose} header={_t("document_viewer|title")} withoutScrollContainer>
                <DocumentViewerView status="error" />
            </BaseCard>
        );
    }

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
