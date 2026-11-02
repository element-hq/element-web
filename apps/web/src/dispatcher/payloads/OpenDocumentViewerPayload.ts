/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type Action } from "../actions";
import { type ActionPayload } from "../payloads";

export interface OpenDocumentViewerPayload extends ActionPayload {
    action: Action.OpenDocumentViewer;

    /** The event whose attachment should be opened in its document viewer. */
    event: MatrixEvent;
}
