/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";
import { IconButton, Tooltip } from "@vector-im/compound-web";
import { MinusIcon, PlusIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import {
    getDocument,
    GlobalWorkerOptions,
    RenderingCancelledException,
    TextLayer,
    type PDFDocumentLoadingTask,
    type PDFDocumentProxy,
    type PDFPageProxy,
    type RenderTask,
} from "pdfjs-dist";
import type { UploadedMedia } from "@element-hq/element-web-module-api";

import { _t } from "../../../languageHandler";
import styles from "./PdfViewer.module.css";

const loggerPdf = logger.getChild("PdfViewer");

const PDF_TO_CSS_UNITS = 96 / 72;
const DEFAULT_ZOOM = 1;
export const PDF_VIEWER_MIN_ZOOM = 0.5;
export const PDF_VIEWER_MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const MAX_CANVAS_PIXELS = 32_000_000;
const WORKER_SRC = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

type PdfDocumentState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; document: PDFDocumentProxy; pageNumbers: number[] };

type PageState = "waiting" | "rendering" | "ready" | "error";

function configurePdfWorker(): void {
    if (!GlobalWorkerOptions.workerSrc) {
        GlobalWorkerOptions.workerSrc = WORKER_SRC;
    }
}

function isCancellationError(error: unknown): boolean {
    return (
        error instanceof RenderingCancelledException ||
        (error instanceof Error && ["AbortException", "RenderingCancelledException"].includes(error.name))
    );
}

function zoomLabel(zoom: number): string {
    return `${Math.round(zoom * 100)}%`;
}

function getOutputScale(viewportWidth: number, viewportHeight: number): number {
    const desiredScale = window.devicePixelRatio || 1;
    const maxScale = Math.sqrt(MAX_CANVAS_PIXELS / (viewportWidth * viewportHeight));
    return Math.max(0.5, Math.min(desiredScale, maxScale));
}

interface PdfPageViewProps {
    document: PDFDocumentProxy;
    pageNumber: number;
    pageCount: number;
    zoom: number;
}

function PdfPageView({ document, pageNumber, pageCount, zoom }: PdfPageViewProps): JSX.Element {
    const pageRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const [shouldRender, setShouldRender] = useState(false);
    const [pageState, setPageState] = useState<PageState>("waiting");

    useEffect(() => {
        setShouldRender(false);
        setPageState("waiting");
    }, [document, pageNumber]);

    useEffect(() => {
        const pageElement = pageRef.current;
        if (!pageElement || shouldRender) return;

        if (typeof IntersectionObserver === "undefined") {
            setShouldRender(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setShouldRender(true);
                    observer.disconnect();
                }
            },
            { rootMargin: "800px 0px" },
        );
        observer.observe(pageElement);

        return () => observer.disconnect();
    }, [shouldRender]);

    useEffect(() => {
        if (!shouldRender) return;

        const canvasElement = canvasRef.current;
        const textLayerCleanupElement = textLayerRef.current;
        let disposed = false;
        let page: PDFPageProxy | undefined;
        let renderTask: RenderTask | undefined;
        let textLayer: TextLayer | undefined;

        const cleanupPage = (): void => {
            try {
                page?.cleanup();
            } catch (error) {
                loggerPdf.warn(`Unable to clean up PDF page ${pageNumber}`, error);
            }
            TextLayer.cleanup();
        };

        const renderPage = async (): Promise<void> => {
            setPageState("rendering");

            page = await document.getPage(pageNumber);
            if (disposed) {
                cleanupPage();
                return;
            }

            const viewport = page.getViewport({ scale: zoom * PDF_TO_CSS_UNITS });
            const pageElement = pageRef.current;
            const canvas = canvasRef.current;
            const textLayerElement = textLayerRef.current;
            const canvasContext = canvas?.getContext("2d");

            if (!pageElement || !canvas || !textLayerElement || !canvasContext) {
                throw new Error("PDF page canvas is unavailable");
            }

            const outputScale = getOutputScale(viewport.width, viewport.height);
            const canvasWidth = Math.floor(viewport.width * outputScale);
            const canvasHeight = Math.floor(viewport.height * outputScale);

            pageElement.style.width = `${viewport.width}px`;
            pageElement.style.height = `${viewport.height}px`;
            pageElement.style.setProperty("--total-scale-factor", `${viewport.scale}`);

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;

            textLayerElement.replaceChildren();
            textLayerElement.style.width = `${viewport.width}px`;
            textLayerElement.style.height = `${viewport.height}px`;
            textLayerElement.style.setProperty("--total-scale-factor", `${viewport.scale}`);

            renderTask = page.render({
                canvas,
                canvasContext,
                viewport,
                transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
            });
            renderTask.onContinue = (continueRendering: () => void): void => {
                if (typeof window.requestAnimationFrame === "function") {
                    window.requestAnimationFrame(continueRendering);
                } else {
                    window.setTimeout(continueRendering, 0);
                }
            };

            textLayer = new TextLayer({
                container: textLayerElement,
                textContentSource: page.streamTextContent({
                    includeMarkedContent: true,
                    disableNormalization: true,
                }),
                viewport,
            });
            textLayerElement.style.width = `${viewport.width}px`;
            textLayerElement.style.height = `${viewport.height}px`;

            await Promise.all([renderTask.promise, textLayer.render()]);

            if (!disposed) {
                setPageState("ready");
            }
        };

        void renderPage().catch((error: unknown) => {
            if (disposed || isCancellationError(error)) return;

            loggerPdf.error(`Unable to render PDF page ${pageNumber}`, error);
            setPageState("error");
        });

        return () => {
            disposed = true;
            textLayer?.cancel();
            renderTask?.cancel();

            if (renderTask) {
                void renderTask.promise.catch(() => {}).finally(cleanupPage);
            } else {
                cleanupPage();
            }

            if (canvasElement) {
                canvasElement.width = 0;
                canvasElement.height = 0;
            }
            textLayerCleanupElement?.replaceChildren();
        };
    }, [document, pageNumber, shouldRender, zoom]);

    return (
        <div
            className={classNames(styles.page, { [styles.placeholder]: pageState === "waiting" })}
            data-testid="pdf-page"
            ref={pageRef}
            role="region"
            aria-label={_t("pdf_viewer|page_label", { page: pageNumber, total: pageCount })}
        >
            <canvas className={styles.canvas} ref={canvasRef} aria-hidden="true" />
            <div className={styles.textLayer} ref={textLayerRef} />
            {pageState === "waiting" || pageState === "rendering" ? (
                <div className={styles.pageMessage} role="status" aria-live="polite">
                    {_t("pdf_viewer|loading_page", { page: pageNumber })}
                </div>
            ) : null}
            {pageState === "error" ? (
                <div className={classNames(styles.pageMessage, styles.error)} role="alert">
                    {_t("pdf_viewer|error_render")}
                </div>
            ) : null}
        </div>
    );
}

export function PdfViewer({ media }: { media: UploadedMedia }): JSX.Element {
    const [documentState, setDocumentState] = useState<PdfDocumentState>({ status: "loading" });
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);

    useEffect(() => {
        let disposed = false;
        let loadingTask: PDFDocumentLoadingTask | undefined;

        setZoom(DEFAULT_ZOOM);
        setDocumentState({ status: "loading" });

        const loadDocument = async (): Promise<void> => {
            configurePdfWorker();

            const blob = await media.blob();
            if (blob.size === 0) {
                throw new Error("PDF attachment is empty");
            }

            const data = new Uint8Array(await blob.arrayBuffer());
            if (disposed) return;

            loadingTask = getDocument({ data, stopAtErrors: true });
            const document = await loadingTask.promise;

            if (disposed) {
                await loadingTask.destroy();
                return;
            }

            setDocumentState({
                status: "ready",
                document,
                pageNumbers: Array.from({ length: document.numPages }, (_, index) => index + 1),
            });
        };

        void loadDocument().catch((error: unknown) => {
            if (disposed || isCancellationError(error)) return;

            loggerPdf.error("Unable to load PDF", error);
            setDocumentState({ status: "error" });
        });

        return () => {
            disposed = true;
            if (loadingTask) {
                void loadingTask.destroy().catch((error: unknown) => {
                    if (!isCancellationError(error)) {
                        loggerPdf.warn("Unable to destroy PDF loading task", error);
                    }
                });
            }
        };
    }, [media]);

    const canZoomOut = zoom > PDF_VIEWER_MIN_ZOOM;
    const canZoomIn = zoom < PDF_VIEWER_MAX_ZOOM;
    const currentZoomLabel = useMemo(() => zoomLabel(zoom), [zoom]);

    const onZoomOut = useCallback((): void => {
        setZoom((currentZoom) => Math.max(PDF_VIEWER_MIN_ZOOM, currentZoom - ZOOM_STEP));
    }, []);

    const onZoomIn = useCallback((): void => {
        setZoom((currentZoom) => Math.min(PDF_VIEWER_MAX_ZOOM, currentZoom + ZOOM_STEP));
    }, []);

    return (
        <div className={styles.viewer} data-testid="pdf-viewer">
            <div className={styles.toolbar} role="toolbar" aria-label={_t("pdf_viewer|toolbar_label")}>
                <Tooltip label={_t("action|zoom_out")}>
                    <IconButton
                        aria-label={_t("action|zoom_out")}
                        data-testid="pdf-zoom-out"
                        disabled={!canZoomOut}
                        kind="secondary"
                        onClick={onZoomOut}
                        size="28px"
                    >
                        <MinusIcon />
                    </IconButton>
                </Tooltip>
                <span className={styles.zoomValue} data-testid="pdf-zoom-value">
                    {currentZoomLabel}
                </span>
                <Tooltip label={_t("action|zoom_in")}>
                    <IconButton
                        aria-label={_t("action|zoom_in")}
                        data-testid="pdf-zoom-in"
                        disabled={!canZoomIn}
                        kind="secondary"
                        onClick={onZoomIn}
                        size="28px"
                    >
                        <PlusIcon />
                    </IconButton>
                </Tooltip>
            </div>
            {documentState.status === "loading" ? (
                <div className={styles.message} role="status" aria-live="polite">
                    {_t("pdf_viewer|loading")}
                </div>
            ) : null}
            {documentState.status === "error" ? (
                <div className={classNames(styles.message, styles.error)} role="alert">
                    {_t("pdf_viewer|error_load")}
                </div>
            ) : null}
            {documentState.status === "ready" ? (
                <div className={styles.pages}>
                    {documentState.pageNumbers.map((pageNumber) => (
                        <PdfPageView
                            document={documentState.document}
                            key={pageNumber}
                            pageCount={documentState.pageNumbers.length}
                            pageNumber={pageNumber}
                            zoom={zoom}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}
