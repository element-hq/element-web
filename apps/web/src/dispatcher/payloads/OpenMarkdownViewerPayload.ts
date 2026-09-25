/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type Action } from "../actions";
import { type ActionPayload } from "../payloads";

export interface OpenMarkdownViewerPayload extends ActionPayload {
    action: Action.OpenMarkdownViewer;

    /** The event whose Markdown attachment should be opened. */
    event: MatrixEvent;
}
