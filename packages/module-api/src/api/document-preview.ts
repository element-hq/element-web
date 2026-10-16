/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Describes a file to preview, so that a preview can be picked before its contents are fetched.
 * @alpha Subject to change.
 */
export interface DocumentPreviewFileInfo {
    /**
     * The mimetype of the file, e.g. `application/pdf`.
     */
    mimetype: string;
    /**
     * The file name, shown as the title of the preview. If absent, a generic title is shown.
     * It is also used to pick a preview, e.g. for `README.md` sent as `text/plain`.
     */
    name?: string;
}

/**
 * A file to show in a document preview.
 * @alpha Subject to change.
 */
export interface DocumentPreviewFile {
    /**
     * A function that resolves to a Blob of the file. If this rejects, the document
     * preview will show a generic error.
     */
    blob: () => Promise<Blob>;
}

/**
 * Opens a file in a document preview, in the right panel of the room currently being viewed.
 * The file is shown under the name given to {@link DocumentPreviewApi.getPreviewOpener}.
 * An error fetching the file is shown in the preview rather than thrown.
 * @param file - The file to show.
 * @throws If document previews have been turned off since the opener was returned.
 * @throws If no room is being viewed.
 * @alpha Subject to change.
 */
export type DocumentPreviewOpener = (file: DocumentPreviewFile) => void;

/**
 * API for showing in-app document previews.
 * @alpha Subject to change.
 */
export interface DocumentPreviewApi {
    /**
     * Get a function that opens the described file in a document preview.
     *
     * @param file - The mimetype and name of the file to open.
     * @returns The function, or null if the file cannot be previewed.
     * @alpha Subject to change.
     */
    getPreviewOpener(file: DocumentPreviewFileInfo): DocumentPreviewOpener | null;
}
