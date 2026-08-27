/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type ChangeEvent,
    type FormEvent,
    type JSX,
    type KeyboardEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import classNames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";
import {
    AnnotationEditorType,
    AnnotationMode,
    getDocument,
    GlobalWorkerOptions,
    RenderingCancelledException,
    type PDFDocumentLoadingTask,
    type PDFDocumentProxy,
} from "pdfjs-dist";
import { EventBus, PDFLinkService, PDFViewer as PdfJsViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import type { UploadedMedia } from "@element-hq/element-web-module-api";

import { _t } from "../../../languageHandler";
import styles from "./PdfViewer.module.css";

const loggerPdf = logger.getChild("PdfViewer");

const WORKER_SRC = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
const PDF_SCROLL_POSITION_CACHE_LIMIT = 100;

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

type ViewerStatus = "loading" | "ready" | "error";

interface ScrollPosition {
    left: number;
    top: number;
}

/** Safari's non-standard trackpad pinch event. */
interface GestureEvent extends Event {
    readonly clientX: number;
    readonly clientY: number;
    readonly scale: number;
}

const mediaScrollKeys = new WeakMap<UploadedMedia, string>();
const scrollPositionCache = new Map<string, ScrollPosition>();
let nextMediaScrollKey = 0;

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

function getMediaScrollKey(media: UploadedMedia): string {
    const existingKey = mediaScrollKeys.get(media);
    if (existingKey) return existingKey;

    const key = `${media.name}:${++nextMediaScrollKey}`;
    mediaScrollKeys.set(media, key);
    return key;
}

function rememberScrollPosition(key: string, position: ScrollPosition): void {
    scrollPositionCache.delete(key);
    scrollPositionCache.set(key, position);

    if (scrollPositionCache.size > PDF_SCROLL_POSITION_CACHE_LIMIT) {
        const oldestKey = scrollPositionCache.keys().next().value;
        if (oldestKey) scrollPositionCache.delete(oldestKey);
    }
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
 * loading the attachment, driving zoom from wheel and pinch input, and remembering the scroll position
 * so reopening the file — or coming back to it after switching rooms — lands where you left off.
 */
export function PdfViewer({ media }: { media: UploadedMedia }): JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerElementRef = useRef<HTMLDivElement>(null);
    const pdfViewerRef = useRef<PdfJsViewer | undefined>(undefined);
    const [status, setStatus] = useState<ViewerStatus>("loading");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageCount, setPageCount] = useState(0);
    const [pageInput, setPageInput] = useState("1");
    // While the box has focus the viewer must not overwrite what is being typed, even though
    // scrolling keeps reporting new pages underneath.
    const isEditingPageRef = useRef(false);
    // Escape blurs the box, and blur commits — so the cancellation has to survive into the blur.
    const isPageEditCancelledRef = useRef(false);
    const scrollPositionKey = useMemo(() => getMediaScrollKey(media), [media]);

    useEffect(() => {
        if (isEditingPageRef.current) return;

        setPageInput(String(currentPage));
    }, [currentPage]);

    useEffect(() => {
        const container = containerRef.current;
        const viewerElement = viewerElementRef.current;
        if (!container || !viewerElement) return;

        configurePdfWorker();
        setStatus("loading");
        setCurrentPage(1);
        setPageCount(0);

        let disposed = false;
        let loadingTask: PDFDocumentLoadingTask | undefined;
        let pdfDocument: PDFDocumentProxy | undefined;

        const eventBus = new EventBus();
        const linkService = new PDFLinkService({ eventBus });
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

        const onPagesInit = (): void => {
            pdfViewer.currentScaleValue = FIT_TO_WIDTH;
            setPageCount(pdfViewer.pagesCount);
            setCurrentPage(pdfViewer.currentPageNumber);

            // pdf.js sizes every page from the document up front, so the scroll height is already
            // correct here and a restored offset lands where it did before.
            const scrollPosition = scrollPositionCache.get(scrollPositionKey);
            if (scrollPosition) {
                container.scrollLeft = scrollPosition.left;
                container.scrollTop = scrollPosition.top;
            }

            setStatus("ready");
        };

        eventBus.on("pagesinit", onPagesInit);
        eventBus.on("pagechanging", onPageChanging);

        const loadDocument = async (): Promise<void> => {
            const blob = await media.blob();
            if (blob.size === 0) {
                throw new Error("PDF attachment is empty");
            }

            const data = new Uint8Array(await blob.arrayBuffer());
            if (disposed) return;

            loadingTask = getDocument({ data, stopAtErrors: true });
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

            rememberScrollPosition(scrollPositionKey, {
                left: container.scrollLeft,
                top: container.scrollTop,
            });

            pdfViewerRef.current = undefined;
            pdfViewer.cleanup();
            pdfViewer.setDocument(null as unknown as PDFDocumentProxy);
            linkService.setDocument(null);

            void loadingTask?.destroy().catch((error: unknown) => {
                if (!isCancellationError(error)) {
                    loggerPdf.warn("Unable to destroy PDF loading task", error);
                }
            });
        };
    }, [media, scrollPositionKey]);

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

    const onPageInputChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
        setPageInput(event.target.value);
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

    const onPageInputKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>): void => {
            if (event.key !== "Escape") return;

            // Abandon the edit and snap back to wherever the document actually is.
            isPageEditCancelledRef.current = true;
            setPageInput(String(currentPage));
            event.currentTarget.blur();
        },
        [currentPage],
    );

    const onPageFormSubmit = useCallback(
        (event: FormEvent<HTMLFormElement>): void => {
            event.preventDefault();
            commitPageInput();
        },
        [commitPageInput],
    );

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

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateScrollPosition = (): void => {
            rememberScrollPosition(scrollPositionKey, {
                left: container.scrollLeft,
                top: container.scrollTop,
            });
        };

        container.addEventListener("scroll", updateScrollPosition, { passive: true });

        return () => container.removeEventListener("scroll", updateScrollPosition);
    }, [scrollPositionKey]);

    return (
        <div className={styles.viewer} data-testid="pdf-viewer">
            {pageCount > 0 ? (
                <div
                    className={styles.toolbar}
                    role="group"
                    aria-label={_t("pdf_viewer|page_label", { page: currentPage, total: pageCount })}
                >
                    <form className={styles.pageForm} onSubmit={onPageFormSubmit}>
                        <input
                            aria-label={_t("pdf_viewer|page_number")}
                            className={styles.pageInput}
                            data-testid="pdf-page-input"
                            inputMode="numeric"
                            onBlur={onPageInputBlur}
                            onChange={onPageInputChange}
                            onFocus={onPageInputFocus}
                            onKeyDown={onPageInputKeyDown}
                            value={pageInput}
                        />
                        <span aria-hidden="true" className={styles.pageSeparator}>
                            |
                        </span>
                        <span className={styles.pageTotal} data-testid="pdf-page-total">
                            {pageCount}
                        </span>
                    </form>
                </div>
            ) : null}
            <div className={styles.body}>
                <div className={styles.container} data-testid="pdf-container" ref={containerRef}>
                    <div className="pdfViewer" ref={viewerElementRef} />
                </div>
                {status === "loading" ? (
                    <div className={styles.message} role="status" aria-live="polite">
                        {_t("pdf_viewer|loading")}
                    </div>
                ) : null}
                {status === "error" ? (
                    <div className={classNames(styles.message, styles.error)} role="alert">
                        {_t("pdf_viewer|error_load")}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
