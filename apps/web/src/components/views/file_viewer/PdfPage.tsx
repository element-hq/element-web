/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, useEffect, useRef } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

interface Props {
    doc: PDFDocumentProxy;
    pageNumber: number;
    /** The width, in CSS pixels, the page should be rendered at. Nothing is rendered until this is known. */
    width: number | undefined;
}

/**
 * Rasterises a single page of a PDF onto a canvas, re-rendering whenever the available width changes.
 */
export function PdfPage({ doc, pageNumber, width }: Props): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!width || !canvas) return;

        let disposed = false;
        let task: RenderTask | undefined;

        (async (): Promise<void> => {
            const page = await doc.getPage(pageNumber);
            if (disposed) return;

            // Render at the device pixel ratio so the page isn't blurry on hidpi screens, but lay the
            // canvas out at the CSS size we were asked for.
            const scale = width / page.getViewport({ scale: 1 }).width;
            const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${Math.floor(page.getViewport({ scale }).height)}px`;

            task = page.render({ canvas, viewport });
            await task.promise;
        })().catch((e) => {
            // Cancelling a render (because the width changed, or we unmounted) rejects the promise.
            if (disposed || (e as Error).name === "RenderingCancelledException") return;
            logger.error(`Failed to render page ${pageNumber} of PDF`, e);
        });

        return () => {
            disposed = true;
            task?.cancel();
        };
    }, [doc, pageNumber, width]);

    return <canvas className="mx_PdfViewer_page" ref={canvasRef} />;
}
