/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/**
 * The handle on an attachment that a document viewer needs: something to key per-file state on, and
 * a way to get at the bytes. `blob` is expected to decrypt transparently for encrypted media, so a
 * viewer never has to care whether the room is encrypted.
 */
export interface DocumentMedia {
    /** The MXC URI of the file. */
    uri: string;
    /** The file name, as sent. */
    name?: string;
    /** The size in bytes the sender declared for the file, if any. A claim, not a measurement. */
    size?: number;
    /** Resolves the file contents, decrypting first if the media is encrypted. */
    blob: () => Promise<Blob>;
}
