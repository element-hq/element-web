/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type CSSProperties,
    type JSX,
    memo,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import classNames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";
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
const WHEEL_LINE_HEIGHT = 32;
const WHEEL_PAGE_HEIGHT = 400;
const WHEEL_ZOOM_SENSITIVITY = 0.0022;
const MAX_WHEEL_ZOOM_FACTOR = 1.5;
export const PDF_VIEWER_ZOOM_RENDER_DEBOUNCE_MS = 180;
const PDF_VIEWER_ABSOLUTE_MIN_ZOOM = 0.05;
const PDF_SCROLL_POSITION_CACHE_LIMIT = 100;
const PAGE_RENDER_ROOT_MARGIN = "800px 0px";
const PAGE_RETENTION_ROOT_MARGIN = "3000px 0px";
const NO_OWNER = 0;
const MAX_CANVAS_PIXELS = 32_000_000;
const WORKER_SRC = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

type PdfDocumentState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; document: PDFDocumentProxy; pageNumbers: number[]; pageWidth: number };

type PageState = "waiting" | "rendering" | "ready" | "error";

interface RenderedLayer {
    height: number;
    index: LayerIndex;
    width: number;
    zoom: number;
}

interface LayerElements {
    canvas: HTMLCanvasElement | null;
    container: HTMLDivElement | null;
    textLayer: HTMLDivElement | null;
}

type LayerIndex = 0 | 1;

interface ScheduledCallback {
    id: number;
    type: "idle" | "timeout";
}

interface ScrollAnchor {
    left: number;
    top: number;
    viewportX: number;
    viewportY: number;
    zoom: number;
}

interface ScrollPosition {
    left: number;
    top: number;
}

type ZoomMode = "fit" | "manual";

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

function getOutputScale(viewportWidth: number, viewportHeight: number): number {
    const desiredScale = window.devicePixelRatio || 1;
    const maxScale = Math.sqrt(MAX_CANVAS_PIXELS / (viewportWidth * viewportHeight));
    return Math.max(0.5, Math.min(desiredScale, maxScale));
}

function clearLayer(layer: LayerElements | undefined): void {
    if (!layer) return;

    if (layer.canvas) {
        layer.canvas.width = 0;
        layer.canvas.height = 0;
        layer.canvas.removeAttribute("style");
    }

    layer.container?.removeAttribute("style");
    layer.textLayer?.replaceChildren();
    layer.textLayer?.removeAttribute("style");
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

function clampZoom(zoom: number, minZoom = PDF_VIEWER_MIN_ZOOM): number {
    return Math.max(minZoom, Math.min(PDF_VIEWER_MAX_ZOOM, zoom));
}

function getMinimumZoom(fitZoom: number | undefined): number {
    return fitZoom === undefined ? PDF_VIEWER_MIN_ZOOM : Math.min(PDF_VIEWER_MIN_ZOOM, fitZoom);
}

/**
 * Turn a wheel delta into a multiplicative zoom factor. Zooming is exponential so that a step feels the
 * same size at every zoom level, and the delta magnitude is honoured so a trackpad pinch — which arrives
 * as a stream of small ctrl+wheel deltas — reads as a continuous gesture rather than a series of jumps.
 */
function getWheelZoomFactor(delta: number, deltaMode: number): number {
    const deltaScale = deltaMode === 1 ? WHEEL_LINE_HEIGHT : deltaMode === 2 ? WHEEL_PAGE_HEIGHT : 1;
    const factor = Math.exp(-delta * deltaScale * WHEEL_ZOOM_SENSITIVITY);

    return Math.min(MAX_WHEEL_ZOOM_FACTOR, Math.max(1 / MAX_WHEEL_ZOOM_FACTOR, factor));
}

function getAvailablePageWidth(element: HTMLElement): number {
    const style = window.getComputedStyle(element);
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;

    return Math.max(1, element.clientWidth - paddingLeft - paddingRight);
}

function calculateFitZoom(container: HTMLElement, pageWidth: number): number {
    if (pageWidth <= 0 || container.clientWidth <= 0) return DEFAULT_ZOOM;

    return clampZoom(getAvailablePageWidth(container) / pageWidth, PDF_VIEWER_ABSOLUTE_MIN_ZOOM);
}

function getAnchorPoint(container: HTMLElement, point?: { x: number; y: number }): { x: number; y: number } {
    if (point) return point;

    const rect = container.getBoundingClientRect();
    return {
        x: rect.left + container.clientWidth / 2,
        y: rect.top + container.clientHeight / 2,
    };
}

function captureScrollAnchor(container: HTMLElement, zoom: number, point?: { x: number; y: number }): ScrollAnchor {
    const rect = container.getBoundingClientRect();
    const anchorPoint = getAnchorPoint(container, point);

    return {
        left: container.scrollLeft,
        top: container.scrollTop,
        viewportX: Math.max(0, Math.min(container.clientWidth, anchorPoint.x - rect.left)),
        viewportY: Math.max(0, Math.min(container.clientHeight, anchorPoint.y - rect.top)),
        zoom,
    };
}

function restoreScrollAnchor(container: HTMLElement, anchor: ScrollAnchor, nextZoom: number): void {
    const zoomRatio = nextZoom / anchor.zoom;
    container.scrollLeft = Math.max(0, (anchor.left + anchor.viewportX) * zoomRatio - anchor.viewportX);
    container.scrollTop = Math.max(0, (anchor.top + anchor.viewportY) * zoomRatio - anchor.viewportY);
}

function scheduleIdleCallback(callback: () => void, timeout: number): ScheduledCallback {
    if (typeof window.requestIdleCallback === "function") {
        return {
            id: window.requestIdleCallback(callback, { timeout }),
            type: "idle",
        };
    }

    return {
        id: window.setTimeout(callback, 0),
        type: "timeout",
    };
}

function cancelScheduledCallback(scheduledCallback: ScheduledCallback): void {
    if (scheduledCallback.type === "idle" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(scheduledCallback.id);
    } else {
        window.clearTimeout(scheduledCallback.id);
    }
}

interface PdfPageViewProps {
    document: PDFDocumentProxy;
    eager: boolean;
    onRenderComplete: (pageNumber: number) => void;
    pageNumber: number;
    pageCount: number;
    renderZoom: number;
}

const PdfPageView = memo(function PdfPageView({
    document,
    eager,
    onRenderComplete,
    pageNumber,
    pageCount,
    renderZoom,
}: PdfPageViewProps): JSX.Element {
    const pageRef = useRef<HTMLDivElement>(null);
    const layerRefs = useRef<[LayerElements, LayerElements]>([
        { canvas: null, container: null, textLayer: null },
        { canvas: null, container: null, textLayer: null },
    ]);
    const renderedLayerRef = useRef<RenderedLayer | undefined>(undefined);
    // Token of the render task that owns each back buffer, or `NO_OWNER` when the buffer is free. A
    // superseded render must not clear a buffer that its replacement has already claimed.
    const bufferOwnersRef = useRef<[number, number]>([NO_OWNER, NO_OWNER]);
    const activeRenderRef = useRef(NO_OWNER);
    const renderTokenRef = useRef(NO_OWNER);
    const pageProxyRef = useRef<PDFPageProxy | undefined>(undefined);
    const [isNearViewport, setIsNearViewport] = useState(false);
    const [isRetained, setIsRetained] = useState(true);
    // Sticky once the page has rastered at least once: its box keeps its size even after the pixels are
    // dropped, so releasing a distant page never shifts the scroll height under the user.
    const [hasGeometry, setHasGeometry] = useState(false);
    const [renderedLayer, setRenderedLayer] = useState<RenderedLayer | undefined>(undefined);
    const [pageState, setPageState] = useState<PageState>("waiting");

    // Without an IntersectionObserver we cannot tell which pages are on screen, so every page stays active.
    const observesVisibility = typeof IntersectionObserver !== "undefined";
    const isActive = isRetained && (eager || isNearViewport || !observesVisibility);
    const hasPixels = renderedLayer !== undefined;

    useEffect(() => {
        renderedLayerRef.current = renderedLayer;
    }, [renderedLayer]);

    useEffect(() => {
        const layers = layerRefs.current;

        setIsNearViewport(false);
        setIsRetained(true);
        setHasGeometry(false);
        setRenderedLayer(undefined);
        setPageState("waiting");

        return () => {
            layers.forEach(clearLayer);
            try {
                pageProxyRef.current?.cleanup();
            } catch (error) {
                loggerPdf.warn(`Unable to clean up PDF page ${pageNumber}`, error);
            }
            pageProxyRef.current = undefined;
            TextLayer.cleanup();
        };
    }, [document, pageNumber]);

    useEffect(() => {
        const pageElement = pageRef.current;
        if (!pageElement || !observesVisibility) return;

        const renderObserver = new IntersectionObserver(([entry]) => setIsNearViewport(entry.isIntersecting), {
            rootMargin: PAGE_RENDER_ROOT_MARGIN,
        });
        const retentionObserver = new IntersectionObserver(([entry]) => setIsRetained(entry.isIntersecting), {
            rootMargin: PAGE_RETENTION_ROOT_MARGIN,
        });
        renderObserver.observe(pageElement);
        retentionObserver.observe(pageElement);

        return () => {
            renderObserver.disconnect();
            retentionObserver.disconnect();
        };
    }, [observesVisibility]);

    useEffect(() => {
        // Pages away from the viewport keep their existing raster and are re-rendered lazily when they
        // scroll back into view, so a zoom step only rasterises what the user can actually see.
        if (!isActive || (renderedLayerRef.current?.zoom === renderZoom && hasPixels)) return;

        const layers = layerRefs.current;
        const token = ++renderTokenRef.current;
        let disposed = false;
        let page: PDFPageProxy | undefined;
        let renderTask: RenderTask | undefined;
        let textLayer: TextLayer | undefined;
        let renderLayerIndex: LayerIndex | undefined;
        let committed = false;

        activeRenderRef.current = token;

        const renderPage = async (): Promise<void> => {
            setPageState("rendering");

            page = await document.getPage(pageNumber);
            pageProxyRef.current = page;
            if (disposed) return;

            const viewport = page.getViewport({ scale: renderZoom * PDF_TO_CSS_UNITS });
            const activeLayer = renderedLayerRef.current;
            renderLayerIndex = activeLayer ? (activeLayer.index === 0 ? 1 : 0) : 0;
            bufferOwnersRef.current[renderLayerIndex] = token;

            const layer = layers[renderLayerIndex];
            const canvas = layer.canvas;
            const textLayerElement = layer.textLayer;
            const canvasContext = canvas?.getContext("2d");

            if (!canvas || !textLayerElement || !canvasContext) {
                throw new Error("PDF page canvas is unavailable");
            }

            const outputScale = getOutputScale(viewport.width, viewport.height);
            const canvasWidth = Math.floor(viewport.width * outputScale);
            const canvasHeight = Math.floor(viewport.height * outputScale);

            clearLayer(layer);
            layer.container?.style.setProperty("width", `${viewport.width}px`);
            layer.container?.style.setProperty("height", `${viewport.height}px`);

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

            await Promise.all([renderTask.promise, textLayer.render()]);

            if (disposed) return;

            committed = true;
            if (activeRenderRef.current === token) {
                activeRenderRef.current = NO_OWNER;
            }

            renderedLayerRef.current = {
                height: viewport.height,
                index: renderLayerIndex,
                width: viewport.width,
                zoom: renderZoom,
            };
            setRenderedLayer(renderedLayerRef.current);
            setHasGeometry(true);
            setPageState("ready");
            onRenderComplete(pageNumber);
        };

        void renderPage().catch((error: unknown) => {
            if (disposed || isCancellationError(error)) return;

            loggerPdf.error(`Unable to render PDF page ${pageNumber}`, error);
            setPageState("error");
        });

        return () => {
            disposed = true;
            if (activeRenderRef.current === token) {
                activeRenderRef.current = NO_OWNER;
            }
            if (committed) return;

            textLayer?.cancel();
            renderTask?.cancel();

            const releaseBuffer = (): void => {
                if (renderLayerIndex === undefined || bufferOwnersRef.current[renderLayerIndex] !== token) return;

                bufferOwnersRef.current[renderLayerIndex] = NO_OWNER;
                clearLayer(layers[renderLayerIndex]);
            };

            if (renderTask) {
                void renderTask.promise.catch(() => {}).finally(releaseBuffer);
            } else {
                releaseBuffer();
            }
        };
    }, [document, hasPixels, isActive, onRenderComplete, pageNumber, renderZoom]);

    // A page far outside the viewport gives up its canvases. Each one can hold tens of megabytes at high
    // zoom, and nothing else ever frees them for a document the user has scrolled through.
    useEffect(() => {
        if (isRetained || !hasGeometry || !renderedLayer) return;

        bufferOwnersRef.current = [NO_OWNER, NO_OWNER];
        renderedLayerRef.current = undefined;
        setRenderedLayer(undefined);
        layerRefs.current.forEach(clearLayer);
    }, [hasGeometry, isRetained, renderedLayer]);

    // Publish the new raster's geometry and retire the superseded buffer in the same commit that makes
    // the new buffer visible, so the swap costs a single frame instead of a cross-fade between two
    // differently scaled rasters of the same page — and no frame is ever painted at a mismatched scale.
    useLayoutEffect(() => {
        if (!renderedLayer) return;

        const pageElement = pageRef.current;
        pageElement?.style.setProperty("--pdf-page-width", `${renderedLayer.width}px`);
        pageElement?.style.setProperty("--pdf-page-height", `${renderedLayer.height}px`);
        pageElement?.style.setProperty("--pdf-page-zoom", `${renderedLayer.zoom}`);

        const staleIndex = renderedLayer.index === 0 ? 1 : 0;
        const owner = bufferOwnersRef.current[staleIndex];
        if (owner === NO_OWNER || owner === activeRenderRef.current) return;

        bufferOwnersRef.current[staleIndex] = NO_OWNER;
        clearLayer(layerRefs.current[staleIndex]);
    }, [renderedLayer]);

    return (
        <div
            className={classNames(styles.page, {
                [styles.placeholder]: !hasGeometry,
                [styles.pageSized]: hasGeometry,
            })}
            data-testid="pdf-page"
            ref={pageRef}
            role="region"
            aria-label={_t("pdf_viewer|page_label", { page: pageNumber, total: pageCount })}
        >
            {([0, 1] as const).map((index) => (
                <div
                    className={classNames(styles.renderLayer, {
                        [styles.renderLayerVisible]: renderedLayer?.index === index,
                    })}
                    data-testid="pdf-render-layer"
                    key={index}
                    ref={(element) => {
                        layerRefs.current[index].container = element;
                    }}
                >
                    <canvas
                        className={styles.canvas}
                        ref={(element) => {
                            layerRefs.current[index].canvas = element;
                        }}
                        aria-hidden="true"
                    />
                    <div
                        className={styles.textLayer}
                        ref={(element) => {
                            layerRefs.current[index].textLayer = element;
                        }}
                    />
                </div>
            ))}
            {(pageState === "waiting" || pageState === "rendering") && !hasGeometry ? (
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
});

export function PdfViewer({ media }: { media: UploadedMedia }): JSX.Element {
    const viewerRef = useRef<HTMLDivElement>(null);
    const pagesRef = useRef<HTMLDivElement>(null);
    const [documentState, setDocumentState] = useState<PdfDocumentState>({ status: "loading" });
    const [eagerPageNumbers, setEagerPageNumbers] = useState<ReadonlySet<number>>(() => new Set([1]));
    const [displayZoom, setDisplayZoom] = useState(DEFAULT_ZOOM);
    const [renderZoom, setRenderZoom] = useState(DEFAULT_ZOOM);
    const [fitZoom, setFitZoom] = useState<number | undefined>(undefined);
    const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
    const displayZoomRef = useRef(DEFAULT_ZOOM);
    const pendingZoomRef = useRef<{ factor: number; anchorPoint?: { x: number; y: number } } | undefined>(undefined);
    const zoomFrameRef = useRef<number | undefined>(undefined);
    const pendingScrollAnchorRef = useRef<ScrollAnchor | undefined>(undefined);
    const hasFitZoomRef = useRef(false);
    const scheduledInitialPrefetchRef = useRef(false);
    const scheduledInitialPrefetchTaskRef = useRef<ScheduledCallback | undefined>(undefined);
    const restoredScrollPositionRef = useRef(false);
    const scrollPositionKey = useMemo(() => getMediaScrollKey(media), [media]);

    useLayoutEffect(() => {
        displayZoomRef.current = displayZoom;
    }, [displayZoom]);

    useEffect(() => {
        let disposed = false;
        let loadingTask: PDFDocumentLoadingTask | undefined;
        const scheduledInitialPrefetchTask = scheduledInitialPrefetchTaskRef.current;
        if (scheduledInitialPrefetchTask) {
            cancelScheduledCallback(scheduledInitialPrefetchTask);
            scheduledInitialPrefetchTaskRef.current = undefined;
        }

        hasFitZoomRef.current = false;
        scheduledInitialPrefetchRef.current = false;
        restoredScrollPositionRef.current = false;
        setEagerPageNumbers(new Set([1]));
        setDisplayZoom(DEFAULT_ZOOM);
        setRenderZoom(DEFAULT_ZOOM);
        setFitZoom(undefined);
        setZoomMode("fit");
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
            const firstPage = await document.getPage(1);
            const pageWidth = firstPage.getViewport({ scale: PDF_TO_CSS_UNITS }).width;
            firstPage.cleanup();

            if (disposed) {
                await loadingTask.destroy();
                return;
            }

            setDocumentState({
                status: "ready",
                document,
                pageNumbers: Array.from({ length: document.numPages }, (_, index) => index + 1),
                pageWidth,
            });
        };

        void loadDocument().catch((error: unknown) => {
            if (disposed || isCancellationError(error)) return;

            loggerPdf.error("Unable to load PDF", error);
            setDocumentState({ status: "error" });
        });

        return () => {
            disposed = true;
            const scheduledInitialPrefetchTask = scheduledInitialPrefetchTaskRef.current;
            if (scheduledInitialPrefetchTask) {
                cancelScheduledCallback(scheduledInitialPrefetchTask);
                scheduledInitialPrefetchTaskRef.current = undefined;
            }
            if (loadingTask) {
                void loadingTask.destroy().catch((error: unknown) => {
                    if (!isCancellationError(error)) {
                        loggerPdf.warn("Unable to destroy PDF loading task", error);
                    }
                });
            }
        };
    }, [media]);

    useLayoutEffect(() => {
        if (documentState.status !== "ready") return;

        const pages = pagesRef.current;
        if (!pages) return;

        const updateFitZoom = (): void => {
            const nextFitZoom = calculateFitZoom(pages, documentState.pageWidth);
            const currentZoom = displayZoomRef.current;
            const nextZoom = zoomMode === "fit" ? nextFitZoom : clampZoom(currentZoom, getMinimumZoom(nextFitZoom));
            const isFirstLayout = !hasFitZoomRef.current;
            hasFitZoomRef.current = true;

            setFitZoom(nextFitZoom);
            if (nextZoom === currentZoom) return;

            if (isFirstLayout) {
                // Nothing is on screen to hold still yet, and the cached scroll position is about to be
                // restored. Rasterise straight at the fit zoom rather than at the default and again after.
                setRenderZoom(nextZoom);
            } else {
                // Resizing the panel changes fit zoom, and with it every page's height. Without an anchor
                // the untouched scrollTop would point at a different part of the document than before.
                // Re-rastering is left to the debounce, so dragging the splitter scales the existing
                // raster and rasterises once when the drag settles.
                pendingScrollAnchorRef.current = captureScrollAnchor(pages, currentZoom);
            }

            setDisplayZoom(nextZoom);
        };

        updateFitZoom();

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(updateFitZoom);
            observer.observe(pages);
            return () => observer.disconnect();
        }

        window.addEventListener("resize", updateFitZoom);
        return () => window.removeEventListener("resize", updateFitZoom);
    }, [documentState, zoomMode]);

    useEffect(() => {
        if (displayZoom === renderZoom) return;

        const timeout = window.setTimeout(() => {
            setRenderZoom(displayZoom);
        }, PDF_VIEWER_ZOOM_RENDER_DEBOUNCE_MS);

        return () => window.clearTimeout(timeout);
    }, [displayZoom, renderZoom]);

    useLayoutEffect(() => {
        const pages = pagesRef.current;
        const anchor = pendingScrollAnchorRef.current;
        if (!pages || !anchor) return;

        pendingScrollAnchorRef.current = undefined;
        restoreScrollAnchor(pages, anchor, displayZoom);
    }, [displayZoom]);

    useLayoutEffect(() => {
        if (documentState.status !== "ready" || fitZoom === undefined || restoredScrollPositionRef.current) return;

        const pages = pagesRef.current;
        const scrollPosition = scrollPositionCache.get(scrollPositionKey);
        if (!pages || !scrollPosition) {
            restoredScrollPositionRef.current = true;
            return;
        }

        restoredScrollPositionRef.current = true;
        pages.scrollLeft = scrollPosition.left;
        pages.scrollTop = scrollPosition.top;
    }, [documentState.status, fitZoom, scrollPositionKey]);

    useEffect(() => {
        const pages = pagesRef.current;
        if (!pages) return;

        const updateScrollPosition = (): void => {
            rememberScrollPosition(scrollPositionKey, {
                left: pages.scrollLeft,
                top: pages.scrollTop,
            });
        };

        pages.addEventListener("scroll", updateScrollPosition, { passive: true });

        return () => {
            updateScrollPosition();
            pages.removeEventListener("scroll", updateScrollPosition);
        };
    }, [documentState.status, fitZoom, scrollPositionKey]);

    const setZoom = useCallback(
        (resolveZoom: (currentZoom: number) => number, anchorPoint?: { x: number; y: number }): void => {
            const pages = pagesRef.current;
            if (pages) {
                pendingScrollAnchorRef.current = captureScrollAnchor(pages, displayZoomRef.current, anchorPoint);
            }

            setZoomMode("manual");
            setDisplayZoom((currentZoom) => clampZoom(resolveZoom(currentZoom), getMinimumZoom(fitZoom)));
        },
        [fitZoom],
    );

    /**
     * Continuous input can arrive far faster than a frame, and every zoom step reads layout to anchor the
     * scroll position. Coalescing into an animation frame keeps one gesture to one layout pass.
     */
    const queueZoomBy = useCallback(
        (factor: number, anchorPoint?: { x: number; y: number }): void => {
            const pending = pendingZoomRef.current;
            pendingZoomRef.current = {
                factor: (pending?.factor ?? 1) * factor,
                anchorPoint: anchorPoint ?? pending?.anchorPoint,
            };

            // A pending zoom is itself the record that a frame is already queued for it, which stays
            // correct however the frame callback is scheduled relative to the handle being stored.
            if (pending) return;

            const flushZoom = (): void => {
                zoomFrameRef.current = undefined;
                const queuedZoom = pendingZoomRef.current;
                pendingZoomRef.current = undefined;
                if (!queuedZoom) return;

                setZoom((currentZoom) => currentZoom * queuedZoom.factor, queuedZoom.anchorPoint);
            };

            if (typeof window.requestAnimationFrame !== "function") {
                flushZoom();
                return;
            }

            zoomFrameRef.current = window.requestAnimationFrame(flushZoom);
        },
        [setZoom],
    );

    useEffect(
        () => () => {
            if (zoomFrameRef.current !== undefined) {
                window.cancelAnimationFrame(zoomFrameRef.current);
                zoomFrameRef.current = undefined;
            }
        },
        [],
    );

    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const onWheel = (event: WheelEvent): void => {
            if (!event.ctrlKey && !event.metaKey) return;

            const delta = event.deltaY || event.deltaX;
            if (delta === 0) return;

            event.preventDefault();
            queueZoomBy(getWheelZoomFactor(delta, event.deltaMode), { x: event.clientX, y: event.clientY });
        };

        viewer.addEventListener("wheel", onWheel, { passive: false });

        return () => viewer.removeEventListener("wheel", onWheel);
    }, [queueZoomBy]);

    useEffect(() => {
        const viewer = viewerRef.current;
        // Safari reports trackpad pinches as gesture events rather than as ctrl+wheel.
        if (!viewer || !("ongesturechange" in window)) return;

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
            queueZoomBy(factor, { x: gestureEvent.clientX, y: gestureEvent.clientY });
        };

        const onGestureEnd = (event: Event): void => event.preventDefault();

        viewer.addEventListener("gesturestart", onGestureStart);
        viewer.addEventListener("gesturechange", onGestureChange);
        viewer.addEventListener("gestureend", onGestureEnd);

        return () => {
            viewer.removeEventListener("gesturestart", onGestureStart);
            viewer.removeEventListener("gesturechange", onGestureChange);
            viewer.removeEventListener("gestureend", onGestureEnd);
        };
    }, [queueZoomBy]);

    const onPageRenderComplete = useCallback(
        (pageNumber: number): void => {
            if (pageNumber !== 1 || scheduledInitialPrefetchRef.current || documentState.status !== "ready") return;

            scheduledInitialPrefetchRef.current = true;
            const prefetchPages = (): void => {
                scheduledInitialPrefetchTaskRef.current = undefined;
                setEagerPageNumbers((currentPages) => {
                    const nextPages = new Set(currentPages);
                    for (
                        let nextPageNumber = 2;
                        nextPageNumber <= Math.min(documentState.document.numPages, 3);
                        nextPageNumber++
                    ) {
                        nextPages.add(nextPageNumber);
                    }
                    return nextPages;
                });
            };

            scheduledInitialPrefetchTaskRef.current = scheduleIdleCallback(prefetchPages, 500);
        },
        [documentState],
    );

    return (
        <div className={styles.viewer} data-testid="pdf-viewer" ref={viewerRef}>
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
                <div
                    className={styles.pages}
                    data-testid="pdf-pages"
                    ref={pagesRef}
                    style={{ "--pdf-display-zoom": `${displayZoom}` } as CSSProperties}
                >
                    {fitZoom === undefined ? (
                        <div className={styles.message} role="status" aria-live="polite">
                            {_t("pdf_viewer|loading")}
                        </div>
                    ) : (
                        documentState.pageNumbers.map((pageNumber) => (
                            <PdfPageView
                                document={documentState.document}
                                eager={pageNumber === 1 || eagerPageNumbers.has(pageNumber)}
                                key={pageNumber}
                                onRenderComplete={onPageRenderComplete}
                                pageCount={documentState.pageNumbers.length}
                                pageNumber={pageNumber}
                                renderZoom={renderZoom}
                            />
                        ))
                    )}
                </div>
            ) : null}
        </div>
    );
}
