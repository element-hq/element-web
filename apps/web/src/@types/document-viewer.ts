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
    /**
     * The MXC URI of the file. Absent for a file that did not come from Matrix, in which case viewers keep
     * no per-file state for it.
     */
    uri?: string;
    /** The file name, as sent. */
    name?: string;
    /** The size in bytes the sender declared for the file, if any. A claim, not a measurement. */
    size?: number;
    /** Resolves the file contents, decrypting first if the media is encrypted. */
    blob: () => Promise<Blob>;
}

/**
 * A file to open in a document viewer that does not come from an event, e.g. one supplied by a module.
 */
export interface DocumentFile {
    /** The mimetype of the file, used to pick a viewer before the contents are fetched. */
    mimetype: string;
    /** The file name, shown as the title of the viewer. */
    name?: string;
    /**
     * Resolves the file contents. Called when the viewer loads the file; if it rejects, the viewer shows
     * its load error.
     */
    blob: () => Promise<Blob>;
}
