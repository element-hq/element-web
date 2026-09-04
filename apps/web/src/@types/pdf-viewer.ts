/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Where the reader had got to in a PDF, in pdf.js's own terms.
 *
 * These are the fields of the `location` pdf.js reports on `updateviewarea`, which is also the shape
 * it accepts back as an `XYZ` destination — so restoring is a matter of handing it straight back. The
 * offsets are in PDF user-space units on {@link page} rather than pixels in the scroll container, so
 * they survive a change of zoom, of panel width, or of device.
 */
export interface PdfViewerState {
    /** 1-based number of the page at the top of the view. */
    page: number;
    /**
     * The zoom, either as a percentage (`123.45`) or as one of pdf.js's named scales — `"page-width"`,
     * `"page-fit"`, `"auto"` — which are recomputed from the panel size rather than fixed.
     */
    scale: number | string;
    /** Horizontal offset into {@link page}, in PDF user-space units. */
    left: number;
    /** Vertical offset into {@link page}, in PDF user-space units. */
    top: number;
    /** When this position was last recorded, in milliseconds since the epoch. Used to evict old entries. */
    updatedAt: number;
}

/**
 * The handle on a PDF that {@link PdfViewer} needs: something to key the saved reading position on,
 * and a way to get at the bytes. `blob` is expected to decrypt transparently for encrypted media, so
 * the viewer never has to care whether the room is encrypted.
 */
export interface PdfMedia {
    /** The MXC URI of the file, used as the key for its saved reading position. */
    uri: string;
    /** The file name, as sent. */
    name?: string;
    /** Resolves the file contents, decrypting first if the media is encrypted. */
    blob: () => Promise<Blob>;
}
