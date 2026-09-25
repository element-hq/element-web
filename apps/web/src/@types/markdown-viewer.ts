/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/**
 * The handle on a Markdown file that `MarkdownViewer` needs. `blob` is expected to decrypt
 * transparently for encrypted media, so the viewer never has to care whether the room is encrypted.
 */
export interface MarkdownMedia {
    /** The MXC URI of the file. */
    uri: string;
    /** The file name, as sent. */
    name?: string;
    /** The size in bytes the sender declared for the file, if any. A claim, not a measurement. */
    size?: number;
    /** Resolves the file contents, decrypting first if the media is encrypted. */
    blob: () => Promise<Blob>;
}
