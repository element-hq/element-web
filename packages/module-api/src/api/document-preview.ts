/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * A file to show in a document preview.
 * @alpha Subject to change.
 */
export interface DocumentPreviewFile {
    /**
     * A function that resolves to the a Blob of the file. If this rejects, the document
     * preview will show a generic error.
     */
    blob: () => Promise<Blob>;
    /**
     * The file name, shown as the title of the preview. If absent,
     */
    name?: string;
}

/**
 * Opens a file in a document preview, in the right panel of the room currently being viewed.
 * @param file - The file to show.
 * @alpha Subject to change.
 */
export type DocumentPreviewOpener = (file: DocumentPreviewFile) => void;

/**
 * API for showing in-app document previews.
 * @alpha Subject to change.
 */
export interface DocumentPreviewApi {
    /**
     * Get a function that opens files of the given mimetype in a document preview.
     *
     * @param mimetype - The mimetype of the files to open, e.g. `application/pdf`.
     * @returns The function, or null if the file cannot be previewed.
     * @alpha Subject to change.
     */
    getPreviewOpener(mimetype: string): DocumentPreviewOpener | null;
}
