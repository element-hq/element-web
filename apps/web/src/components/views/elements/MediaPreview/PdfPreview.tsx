/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";
import { type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import { logger } from "matrix-js-sdk/src/logger";
import { ChevronLeftIcon, ChevronRightIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../AccessibleButton";
import Spinner from "../Spinner";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { presentableTextForFile } from "../../../../utils/FileUtils";
import MediaPreviewShell from "./MediaPreviewShell";
import { PreviewError } from "./PreviewError";
import { ZoomControls, MAX_ZOOM, MIN_ZOOM, useZoom } from "./ZoomControls";
import { useMediaBytes } from "./useMediaBytes";
import { loadPdfDocument } from "./pdfjs";
import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";

interface Props {
    mxEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    onFinished: () => void;
}

/**
 * Previews a PDF, one page at a time, rendered onto a canvas by pdf.js.
 *
 * We rasterise ourselves rather than pointing an `<iframe>` or `<embed>` at a blob URL: our CSP
 * sets no `object-src`, and a same-origin blob URL of user-supplied content is precisely the XSS
 * vector `utils/blobs.ts` exists to prevent.
 */
export default function PdfPreview({ mxEvent, permalinkCreator, onFinished }: Props): JSX.Element {
    const { data, error: fetchError, helper } = useMediaBytes(mxEvent);
    const { zoom, zoomIn, zoomOut } = useZoom();

    const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
    const [pageCount, setPageCount] = useState(0);
    const [page, setPage] = useState(1);
    const [rendering, setRendering] = useState(true);
    const [renderError, setRenderError] = useState<unknown>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Parse the document once we have the bytes.
    useEffect(() => {
        if (!data) return;

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
                setPageCount(doc.numPages);
                setPage((current) => Math.min(current, doc.numPages));
            })
            .catch((err) => {
                if (cancelled) return;
                logger.error("Failed to parse PDF for preview", err);
                setRenderError(err);
            });

        return () => {
            cancelled = true;
            void task?.destroy();
        };
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
                setRenderError(err);
            });

        return () => {
            cancelled = true;
            task?.cancel();
        };
    }, [document, page, zoom]);

    const previousPage = useCallback(() => setPage((p) => Math.max(p - 1, 1)), []);
    const nextPage = useCallback(() => setPage((p) => Math.min(p + 1, pageCount || p)), [pageCount]);

    const isPaged = pageCount > 1;
    const onAction = useCallback(
        (action: KeyBindingAction): boolean => {
            if (!isPaged) return false;
            if (action === KeyBindingAction.ArrowLeft) {
                previousPage();
                return true;
            }
            if (action === KeyBindingAction.ArrowRight) {
                nextPage();
                return true;
            }
            return false;
        },
        [isPaged, previousPage, nextPage],
    );

    const error = fetchError ?? renderError;

    let body: JSX.Element;
    if (error) {
        body = <PreviewError />;
    } else if (!data) {
        body = <Spinner />;
    } else {
        body = (
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

    const toolbar = (
        <>
            {isPaged && (
                <>
                    <AccessibleButton
                        className="mx_MediaPreview_button"
                        title={_t("file_preview|previous_page")}
                        onClick={previousPage}
                        disabled={page <= 1}
                    >
                        <ChevronLeftIcon />
                    </AccessibleButton>
                    <span className="mx_MediaPreview_pageCount" aria-live="polite">
                        {_t("file_preview|page_of", { page, pageCount })}
                    </span>
                    <AccessibleButton
                        className="mx_MediaPreview_button"
                        title={_t("file_preview|next_page")}
                        onClick={nextPage}
                        disabled={page >= pageCount}
                    >
                        <ChevronRightIcon />
                    </AccessibleButton>
                </>
            )}
            <ZoomControls zoom={zoom} zoomIn={zoomIn} zoomOut={zoomOut} min={MIN_ZOOM} max={MAX_ZOOM} />
        </>
    );

    return (
        <MediaPreviewShell
            label={_t("file_preview|title")}
            mxEvent={mxEvent}
            permalinkCreator={permalinkCreator}
            title={presentableTextForFile(mxEvent.getContent<MediaEventContent>(), _t("common|attachment"), true)}
            downloadUrl={helper.media.srcHttp ?? ""}
            downloadName={helper.fileName}
            toolbar={toolbar}
            onAction={onAction}
            onFinished={onFinished}
        >
            {body}
        </MediaPreviewShell>
    );
}
