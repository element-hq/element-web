/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type * as PdfJs from "pdfjs-dist";
import { type PDFDocumentLoadingTask } from "pdfjs-dist";

import pdfWorkerFactory from "../../../../workers/pdfWorkerFactory";

// Support files that pdf.js fetches lazily, copied into the webapp by CopyWebpackPlugin.
// Paths are relative to the app root, in the same way as the `usercontent/` sandbox.
const CMAP_URL = "pdfjs/cmaps/";
const STANDARD_FONT_URL = "pdfjs/standard_fonts/";
const WASM_URL = "pdfjs/wasm/";
const ICC_URL = "pdfjs/iccs/";

type PdfJsModule = typeof PdfJs;

let pdfjsPromise: Promise<PdfJsModule> | undefined;

/**
 * Import pdf.js on first use and point it at our own bundled worker.
 *
 * pdf.js is well over a megabyte, so it is deliberately kept out of the main bundle and only
 * pulled in when someone actually opens a PDF.
 */
async function getPdfJs(): Promise<PdfJsModule> {
    if (!pdfjsPromise) {
        pdfjsPromise = import(/* webpackChunkName: "pdfjs" */ "pdfjs-dist").then((pdfjs) => {
            // `workerPort` rather than `workerSrc` so the worker comes from a webpack chunk we
            // control, instead of pdf.js guessing a URL to fetch.
            pdfjs.GlobalWorkerOptions.workerPort = pdfWorkerFactory();
            return pdfjs;
        });
    }
    return pdfjsPromise;
}

/**
 * Begin parsing the given bytes as a PDF.
 *
 * The bytes are handed to pdf.js as a copy because it takes ownership of (and detaches) the
 * buffer it is given, and callers hold on to the original for the download button.
 *
 * @param data - the raw, already-decrypted file contents
 * @returns the loading task; await its `promise` for the document, and `destroy()` it when done
 */
export async function loadPdfDocument(data: ArrayBuffer): Promise<PDFDocumentLoadingTask> {
    const pdfjs = await getPdfJs();

    return pdfjs.getDocument({
        data: new Uint8Array(data.slice(0)),
        cMapUrl: CMAP_URL,
        cMapPacked: true,
        standardFontDataUrl: STANDARD_FONT_URL,
        wasmUrl: WASM_URL,
        iccUrl: ICC_URL,
    });
}
