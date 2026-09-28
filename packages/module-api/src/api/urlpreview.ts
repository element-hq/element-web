/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { UrlPreview } from "shared-types";
import type { MatrixEvent } from "../models/event";

/**
 * Render a URL preview for a given URL.
 * @param url The full URL being previewed.
 * @param bundle The room event, if the preview is for an existing Matrix event.
 * @returns A preview, or null if no preview should be visible.
 * @alpha Subject to change.
 */
export type UrlPreviewHandler = (url: string, mxEvent?: MatrixEvent) => Promise<UrlPreview | null>;

/**
 * API for changing the way URL previews are handled.
 * @alpha Subject to change.
 */
export interface UrlPreviewApi {
    /**
     * Register a handler function that will be used to generate URL previews
     * for URLs that match a RegExp.
     * @alpha Subject to change.
     */
    registerPreviewHandler(regex: RegExp, handler: UrlPreviewHandler): void;
}
