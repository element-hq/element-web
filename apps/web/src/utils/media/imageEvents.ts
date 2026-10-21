/*
Copyright 2026

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ImageContent } from "matrix-js-sdk/src/types";

import { isMimeTypeAllowed } from "../blobs";

/**
 * Whether an `m.image` event must be rendered as a plain file rather than an inline image.
 *
 * Encrypted images whose declared mimetype is not one we are willing to render inline are shown
 * as a file download unless the server gave us a thumbnail we can show instead. This mirrors the
 * security fallback in the image message body and must stay in sync with it.
 *
 * @param content - Content of the `m.image` event.
 * @param isEncrypted - Whether the media is encrypted (i.e. the content carries a `file` block).
 */
export function shouldImageFallbackToFileBody(content: ImageContent, isEncrypted: boolean): boolean {
    return isEncrypted && !isMimeTypeAllowed(content.info?.mimetype ?? "") && !content.info?.thumbnail_info;
}
