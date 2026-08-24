/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, useRef, useState } from "react";
import { type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../languageHandler";
import Spinner from "../Spinner";
import { loadPdfDocument } from "./pdfjs";

interface Props {
    /** The raw file contents, already decrypted where applicable. */
    data: ArrayBuffer;
    /** 1-indexed page to display. Clamped to the document length. */
    page: number;
    /** Scale multiplier applied on top of the page's natural size. */
    zoom: number;
    /** Called once the document has been parsed, with its total page count. */
    onLoaded: (pageCount: number) => void;
    /** Called when the document could not be parsed at all. */
    onError: (error: unknown) => void;
}

/**
 * Renders a single page of a PDF onto a canvas using pdf.js.
 *
 * We rasterise ourselves rather than handing a blob URL to an `<iframe>` or `<embed>`: our CSP
 * has no `object-src`, and a same-origin blob URL of user-supplied content is exactly the XSS
 * vector that `utils/blobs.ts` exists to prevent.
 */
export function PdfPreview({ data, page, zoom, onLoaded, onError }: Props): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
    const [rendering, setRendering] = useState(true);

    // Parse the document once per set of bytes.
    useEffect(() => {
        let cancelled = false;
        // Tearing down the loading task also tears down the document and frees the worker's copy
        // of the file, so we hold on to the task rather than the document proxy.
        let task: PDFDocumentLoadingTask | undefined;

        loadPdfDocument(data)
            .then(async (loadingTask) => {
                task = loadingTask;
                const doc = await loadingTask.promise;
                if (cancelled) return;
                setDocument(doc);
                onLoaded(doc.numPages);
            })
            .catch((err) => {
                if (cancelled) return;
                logger.error("Failed to parse PDF for preview", err);
                onError(err);
            });

        return () => {
            cancelled = true;
            void task?.destroy();
        };
        // `onLoaded`/`onError` are stable callbacks from the dialog; re-parsing on every render
        // would be ruinous for large documents.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // Rasterise the current page whenever it, the zoom, or the document changes.
    useEffect(() => {
        if (!document) return;

        let cancelled = false;
        let task: RenderTask | undefined;
        setRendering(true);

        const pageNumber = Math.min(Math.max(page, 1), document.numPages);

        document
            .getPage(pageNumber)
            .then(async (pdfPage) => {
                const canvas = canvasRef.current;
                if (cancelled || !canvas) return;

                // Rasterise at the device pixel ratio so text stays crisp on HiDPI displays,
                // then scale back down in CSS.
                const outputScale = window.devicePixelRatio || 1;
                const viewport = pdfPage.getViewport({ scale: zoom });

                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;

                const context = canvas.getContext("2d");
                if (!context) return;

                task = pdfPage.render({
                    canvas,
                    canvasContext: context,
                    viewport,
                    transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
                });

                await task.promise;
                if (!cancelled) setRendering(false);
            })
            .catch((err) => {
                // A cancelled render rejects; that is expected when paging quickly.
                if (cancelled) return;
                logger.error(`Failed to render PDF page ${pageNumber}`, err);
                onError(err);
            });

        return () => {
            cancelled = true;
            task?.cancel();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [document, page, zoom]);

    return (
        <div className="mx_PdfPreview">
            {rendering && <Spinner />}
            <canvas
                ref={canvasRef}
                className="mx_PdfPreview_canvas"
                hidden={rendering}
                aria-label={_t("file_preview|pdf_page_label", { pageNumber: page })}
            />
        </div>
    );
}
