/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { PdfViewerView, type PdfViewerStatus } from "@element-hq/web-shared-components";
import {
    AnnotationEditorType,
    AnnotationMode,
    getDocument,
    PDFWorker,
    RenderingCancelledException,
    VerbosityLevel,
    type PDFDocumentLoadingTask,
    type PDFDocumentProxy,
} from "pdfjs-dist";
import { EventBus, PDFViewer as PdfJsViewer } from "pdfjs-dist/web/pdf_viewer.mjs";

import { type PdfMedia } from "../../../@types/pdf-viewer";
import { flushPdfViewerState, getPdfViewerState, setPdfViewerState } from "../../../utils/pdfViewerState";
import { ElementPdfLinkService } from "../../../utils/pdfLinkService";

const loggerPdf = logger.getChild("PdfViewer");

const WORKER_SRC = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

/** `%PDF-`, the signature every PDF carries. */
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d];
/**
 * How far in to look for the signature. pdf.js scans exactly this far itself, so anything it would
 * treat as well-formed passes here too — a stricter check would reject files it opens happily.
 */
const PDF_HEADER_SEARCH_LIMIT = 1024;

/**
 * Cap on the attachment itself. The whole file is held in memory for as long as it is open, and the
 * sender chooses how big it is.
 */
const MAX_PDF_BYTES = 256 * 1024 * 1024;

/** Cap on decoded image size. pdf.js defaults to no limit, so a document can exhaust memory. */
const MAX_IMAGE_PIXELS = 8192 * 8192;

/** Scale value that makes pdf.js keep every page fitted to the width of the panel. */
const FIT_TO_WIDTH = "page-width";
/** Scale values pdf.js recomputes from the container size, so they must be re-applied on resize. */
const RESPONSIVE_SCALE_VALUES = new Set(["auto", "page-fit", "page-width"]);

/**
 * How long pdf.js previews a zoom with a CSS transform before re-rastering at the new scale. Keeps a
 * continuous gesture cheap: the pages are only rasterised once the gesture settles.
 */
const ZOOM_DRAWING_DELAY = 400;
const WHEEL_LINE_HEIGHT = 32;
const WHEEL_PAGE_HEIGHT = 400;
const WHEEL_ZOOM_SENSITIVITY = 0.0022;
const MAX_WHEEL_ZOOM_FACTOR = 1.5;

/**
 * The view position pdf.js reports on `updateviewarea`. `left`/`top` are in PDF user-space units on
 * `pageNumber`, and `scale` is either a percentage or one of pdf.js's named scales.
 */
interface PdfLocation {
    pageNumber: number;
    scale: number | string;
    left: number;
    top: number;
}

/** Safari's non-standard trackpad pinch event. */
interface GestureEvent extends Event {
    readonly clientX: number;
    readonly clientY: number;
    readonly scale: number;
}

/**
 * Whether the bytes carry a PDF signature, mirroring how pdf.js looks for one.
 *
 * The mimetype is the sender's claim; this is the first look at what actually arrived. It is not a
 * security control — the signature is five bytes anyone can prepend — it just turns a file that was
 * never a PDF into a clean failure instead of an opaque parser error.
 */
function hasPdfHeader(data: Uint8Array): boolean {
    const lastStart = Math.min(data.length - PDF_HEADER.length, PDF_HEADER_SEARCH_LIMIT);

    for (let start = 0; start <= lastStart; start++) {
        if (PDF_HEADER.every((byte, offset) => data[start + offset] === byte)) return true;
    }

    return false;
}

function isCancellationError(error: unknown): boolean {
    return (
        error instanceof RenderingCancelledException ||
        (error instanceof Error && ["AbortException", "RenderingCancelledException"].includes(error.name))
    );
}

/**
 * Turn a wheel delta into a multiplicative zoom factor. Zooming is exponential so a step feels the same
 * size at every zoom level, and the delta magnitude is honoured so a trackpad pinch — which arrives as a
 * stream of small ctrl+wheel deltas — reads as a continuous gesture rather than a series of jumps.
 */
function getWheelZoomFactor(delta: number, deltaMode: number): number {
    const deltaScale = deltaMode === 1 ? WHEEL_LINE_HEIGHT : deltaMode === 2 ? WHEEL_PAGE_HEIGHT : 1;
    const factor = Math.exp(-delta * deltaScale * WHEEL_ZOOM_SENSITIVITY);

    return Math.min(MAX_WHEEL_ZOOM_FACTOR, Math.max(1 / MAX_WHEEL_ZOOM_FACTOR, factor));
}

/**
 * Renders a PDF attachment using pdf.js's own viewer component.
 *
 * Page layout, lazy rendering, the rendering queue (which renders one page at a time, prioritised by
 * visibility and scroll direction, and pauses rather than discards partial work), the bounded page
 * cache, and transform-previewed zoom all come from {@link PdfJsViewer}. What lives here is the glue:
 * loading the attachment, driving zoom from wheel and pinch input, and persisting the reading position
 * against the file's MXC URI so reopening it — after switching rooms, or in a later session — lands
 * where you left off, at the zoom you were reading at.
 */
export function PdfViewer({ media }: { media: PdfMedia }): JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerElementRef = useRef<HTMLDivElement>(null);
    const pdfViewerRef = useRef<PdfJsViewer | undefined>(undefined);
    const [status, setStatus] = useState<PdfViewerStatus>("loading");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageCount, setPageCount] = useState(0);
    const [pageInput, setPageInput] = useState("1");
    // While the box has focus the viewer must not overwrite what is being typed, even though
    // scrolling keeps reporting new pages underneath.
    const isEditingPageRef = useRef(false);
    // Escape blurs the box, and blur commits — so the cancellation has to survive into the blur.
    const isPageEditCancelledRef = useRef(false);

    useEffect(() => {
        if (isEditingPageRef.current) return;

        setPageInput(String(currentPage));
    }, [currentPage]);

    useEffect(() => {
        const container = containerRef.current;
        const viewerElement = viewerElementRef.current;
        if (!container || !viewerElement) return;

        setStatus("loading");
        setCurrentPage(1);
        setPageCount(0);

        let disposed = false;
        let loadingTask: PDFDocumentLoadingTask | undefined;
        let pdfDocument: PDFDocumentProxy | undefined;

        // Left to itself pdf.js starts its own worker, and if that fails for any reason it falls back to
        // parsing the document on the main thread and carries on. Handing it a worker we made removes
        // that fallback: the untrusted bytes are parsed off the main thread or not at all.
        const worker = new Worker(WORKER_SRC, { type: "module" });
        // pdf.js documents `port` as a Worker but its declaration file types it as `null`.
        const pdfWorker = new PDFWorker({ port: worker } as unknown as ConstructorParameters<typeof PDFWorker>[0]);
        const onWorkerError = (event: ErrorEvent): void => {
            if (disposed) return;

            loggerPdf.error("PDF worker failed", event.error ?? event.message);
            setStatus("error");
        };
        worker.addEventListener("error", onWorkerError);

        const eventBus = new EventBus();
        const linkService = new ElementPdfLinkService({ eventBus });
        const pdfViewer = new PdfJsViewer({
            container,
            viewer: viewerElement,
            eventBus,
            linkService,
            // A chat attachment preview is read-only: no forms, no annotation editing.
            annotationMode: AnnotationMode.DISABLE,
            annotationEditorMode: AnnotationEditorType.DISABLE,
        });
        linkService.setViewer(pdfViewer);
        pdfViewerRef.current = pdfViewer;

        // pdf.js works out which page is current from the pages it can see, and re-reports it as the
        // document scrolls, so the indicator never has to measure anything itself.
        const onPageChanging = ({ pageNumber }: { pageNumber: number }): void => setCurrentPage(pageNumber);

        // Until the saved position has been applied, the positions pdf.js reports are those of a
        // freshly laid-out document — recording them would overwrite the very state being restored.
        let isRestored = false;

        const onPagesInit = (): void => {
            pdfViewer.currentScaleValue = FIT_TO_WIDTH;
            setPageCount(pdfViewer.pagesCount);

            // pdf.js sizes every page from the document up front, so it can already scroll to an
            // arbitrary page here, and it takes the saved position back in the same `XYZ` destination
            // form it handed out — including the named scales, which it re-derives for this panel.
            const savedState = getPdfViewerState(media.uri);
            if (savedState && savedState.page >= 1 && savedState.page <= pdfViewer.pagesCount) {
                const scale = typeof savedState.scale === "number" ? savedState.scale / 100 : savedState.scale;
                pdfViewer.scrollPageIntoView({
                    pageNumber: savedState.page,
                    destArray: [null, { name: "XYZ" }, savedState.left, savedState.top, scale],
                    allowNegativeOffset: true,
                });
            }

            isRestored = true;
            setCurrentPage(pdfViewer.currentPageNumber);
            setStatus("ready");
        };

        // pdf.js recomputes this whenever the view moves — scrolling, zooming, jumping to a page — so
        // it is the whole of the reading position, and it is already expressed in units that survive a
        // different panel width or a different device.
        const onUpdateViewArea = ({ location }: { location?: PdfLocation | null }): void => {
            if (!isRestored || !location) return;

            setPdfViewerState(media.uri, {
                page: location.pageNumber,
                scale: location.scale,
                left: location.left,
                top: location.top,
            });
        };

        eventBus.on("pagesinit", onPagesInit);
        eventBus.on("pagechanging", onPageChanging);
        eventBus.on("updateviewarea", onUpdateViewArea);

        const loadDocument = async (): Promise<void> => {
            // The declared size is the sender's claim, but a claim big enough to refuse saves the download.
            if (media.size !== undefined && media.size > MAX_PDF_BYTES) {
                throw new Error("PDF attachment is too large");
            }

            const blob = await media.blob();
            if (blob.size === 0) {
                throw new Error("PDF attachment is empty");
            }

            const data = new Uint8Array(await blob.arrayBuffer());
            if (!hasPdfHeader(data)) {
                throw new Error("Attachment is not a PDF");
            }

            if (disposed) return;

            loadingTask = getDocument({
                data,
                worker: pdfWorker,
                stopAtErrors: true,
                maxImageSize: MAX_IMAGE_PIXELS,
                // Already the default; pinned so an upstream change cannot quietly enable XFA forms.
                enableXfa: false,
                // pdf.js warns about whatever it finds odd in the file, quoting it, and rageshakes
                // capture the console.
                verbosity: VerbosityLevel.ERRORS,
            });
            pdfDocument = await loadingTask.promise;
            if (disposed) return;

            pdfViewer.setDocument(pdfDocument);
            linkService.setDocument(pdfDocument, null);
        };

        void loadDocument().catch((error: unknown) => {
            if (disposed || isCancellationError(error)) return;

            loggerPdf.error("Unable to load PDF", error);
            setStatus("error");
        });

        return () => {
            disposed = true;
            eventBus.off("pagesinit", onPagesInit);
            eventBus.off("pagechanging", onPageChanging);
            eventBus.off("updateviewarea", onUpdateViewArea);

            // The position recorded as the panel closed is the one worth keeping, so it must not be
            // left sitting in the debounce.
            flushPdfViewerState();

            pdfViewerRef.current = undefined;
            pdfViewer.cleanup();
            pdfViewer.setDocument(null as unknown as PDFDocumentProxy);
            linkService.setDocument(null);

            const destroyed =
                loadingTask?.destroy().catch((error: unknown) => {
                    if (!isCancellationError(error)) {
                        loggerPdf.warn("Unable to destroy PDF loading task", error);
                    }
                }) ?? Promise.resolve();

            // pdf.js only terminates workers it started itself; this one is ours to stop.
            void destroyed.finally(() => {
                worker.removeEventListener("error", onWorkerError);
                pdfWorker.destroy();
                worker.terminate();
            });
        };
    }, [media]);

    const zoomBy = useCallback((factor: number, origin: [number, number]): void => {
        // pdf.js clamps to its own scale bounds, coalesces the gesture, and keeps the point under
        // `origin` fixed while it re-anchors the scroll position.
        pdfViewerRef.current?.updateScale({ scaleFactor: factor, origin, drawingDelay: ZOOM_DRAWING_DELAY });
    }, []);

    const commitPageInput = useCallback((): void => {
        const pdfViewer = pdfViewerRef.current;
        const requestedPage = Number.parseInt(pageInput, 10);

        if (pdfViewer && Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= pageCount) {
            // Assigning this scrolls the page into view; pdf.js then reports it back via `pagechanging`.
            pdfViewer.currentPageNumber = requestedPage;
        } else {
            setPageInput(String(currentPage));
        }
    }, [currentPage, pageCount, pageInput]);

    const onPageInputChange = useCallback((value: string): void => {
        setPageInput(value);
    }, []);

    const onPageInputFocus = useCallback((): void => {
        isEditingPageRef.current = true;
        isPageEditCancelledRef.current = false;
    }, []);

    const onPageInputBlur = useCallback((): void => {
        isEditingPageRef.current = false;

        if (isPageEditCancelledRef.current) {
            isPageEditCancelledRef.current = false;
            setPageInput(String(currentPage));
            return;
        }

        commitPageInput();
    }, [commitPageInput, currentPage]);

    const onPageInputCancel = useCallback((): void => {
        // Abandon the edit and snap back to wherever the document actually is. The View blurs the input,
        // which then runs the guarded blur handler above.
        isPageEditCancelledRef.current = true;
        setPageInput(String(currentPage));
    }, [currentPage]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (event: WheelEvent): void => {
            if (!event.ctrlKey && !event.metaKey) return;

            const delta = event.deltaY || event.deltaX;
            if (delta === 0) return;

            event.preventDefault();
            zoomBy(getWheelZoomFactor(delta, event.deltaMode), [event.clientX, event.clientY]);
        };

        container.addEventListener("wheel", onWheel, { passive: false });

        return () => container.removeEventListener("wheel", onWheel);
    }, [zoomBy]);

    useEffect(() => {
        const container = containerRef.current;
        // Safari reports trackpad pinches as gesture events rather than as ctrl+wheel.
        if (!container || !("ongesturechange" in window)) return;

        let lastGestureScale = 1;

        const onGestureStart = (event: Event): void => {
            event.preventDefault();
            lastGestureScale = (event as GestureEvent).scale || 1;
        };

        const onGestureChange = (event: Event): void => {
            event.preventDefault();
            const gestureEvent = event as GestureEvent;
            const scale = gestureEvent.scale || 1;
            if (lastGestureScale <= 0) {
                lastGestureScale = scale;
                return;
            }

            const factor = scale / lastGestureScale;
            lastGestureScale = scale;
            zoomBy(factor, [gestureEvent.clientX, gestureEvent.clientY]);
        };

        const onGestureEnd = (event: Event): void => event.preventDefault();

        container.addEventListener("gesturestart", onGestureStart);
        container.addEventListener("gesturechange", onGestureChange);
        container.addEventListener("gestureend", onGestureEnd);

        return () => {
            container.removeEventListener("gesturestart", onGestureStart);
            container.removeEventListener("gesturechange", onGestureChange);
            container.removeEventListener("gestureend", onGestureEnd);
        };
    }, [zoomBy]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || typeof ResizeObserver === "undefined") return;

        const observer = new ResizeObserver(() => {
            const pdfViewer = pdfViewerRef.current;
            if (!pdfViewer) return;

            // Fit-to-width is relative to the container, so re-applying it recomputes the scale for the
            // new panel width. pdf.js preserves the visible position across the change itself.
            const scaleValue = pdfViewer.currentScaleValue;
            if (RESPONSIVE_SCALE_VALUES.has(scaleValue)) {
                pdfViewer.currentScaleValue = scaleValue;
            }
            pdfViewer.update();
        });
        observer.observe(container);

        return () => observer.disconnect();
    }, []);

    return (
        <PdfViewerView
            status={status}
            currentPage={currentPage}
            pageCount={pageCount}
            pageInput={pageInput}
            containerRef={containerRef}
            viewerRef={viewerElementRef}
            onPageInputChange={onPageInputChange}
            onPageInputFocus={onPageInputFocus}
            onPageInputBlur={onPageInputBlur}
            onPageInputCancel={onPageInputCancel}
            onPageSubmit={commitPageInput}
        />
    );
}
