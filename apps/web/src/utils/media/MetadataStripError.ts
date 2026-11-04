/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Thrown when a file's metadata could not be removed, usually because the file is malformed or uses a
 * feature of its format that we do not support. The file must not be uploaded as if it had been stripped.
 */
export class MetadataStripError extends Error {
    public constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "MetadataStripError";
    }
}
