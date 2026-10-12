/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";

import { MediaEventHelper } from "./MediaEventHelper";

export const PDF_MIMETYPE = "application/pdf";

/**
 * Whether a file with this mimetype is a PDF the viewer can open. Parameters after the type itself
 * (`application/pdf; version=1.7`) are stripped, since they say nothing about whether we can render it.
 */
export function isPdfMimetype(mimetype?: string): boolean {
    return mimetype?.split(";")[0].trim().toLowerCase() === PDF_MIMETYPE;
}

/** Whether this event carries a PDF the viewer can open. See {@link isPdfMimetype}. */
export function isPdfEvent(mxEvent: MatrixEvent): boolean {
    if (!MediaEventHelper.isEligible(mxEvent)) return false;
    return isPdfMimetype(mxEvent.getContent<MediaEventContent>().info?.mimetype);
}
