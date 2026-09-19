/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    AnnotationEditorType,
    AnnotationMode,
    getDocument,
    PDFWorker,
    RenderingCancelledException,
    VerbosityLevel,
} from "pdfjs-dist";
import { EventBus, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";

import { ElementPdfLinkService } from "./linkService";
import { type PdfPosition, type PdfUsercontentMessage, parsePdfHostMessage } from "./protocol";

/**
 * Runs pdf.js inside the usercontent iframe. The app sends the document over postMessage and gets page
 * numbers and positions back; see `protocol.ts`. One iframe shows one document.
 */

/** pdf.js has no default limit on decoded image size. */
const MAX_IMAGE_PIXELS = 8192 * 8192;
/** pdf.js's own defaults, pinned. */
const MAX_CANVAS_PIXELS = 2 ** 25;
const MAX_CANVAS_DIM = 32767;

const FIT_TO_WIDTH = "page-width";
/** Scales pdf.js derives from the container size, so they must be re-applied on resize. */
const RESPONSIVE_SCALE_VALUES = new Set(["auto", "page-fit", "page-width"]);

/** How long pdf.js previews a zoom with a CSS transform before re-rendering. */
const ZOOM_DRAWING_DELAY = 400;
/** Pixels per wheel unit for each `WheelEvent.deltaMode`: pixel, line, page. */
const WHEEL_DELTA_SCALES = [1, 32, 400];
const WHEEL_ZOOM_SENSITIVITY = 0.0022;
const MAX_WHEEL_ZOOM_FACTOR = 1.5;

/** Posted by the worker bootstrap once pdf.js's worker module has loaded. */
const WORKER_READY = "io.element.pdf.worker_ready";

/**
 * Applied from script once the bundle has loaded: `'self'` means nothing for an opaque origin (WebKit
 * refuses the page's own scripts under it). Allows the blob worker and inline styles, nothing else.
 */
const CONTENT_SECURITY_POLICY = [
    "default-src 'none'",
    "script-src blob:",
    "worker-src blob:",
    "style-src 'unsafe-inline'",
    "img-src blob: data:",
    "font-src blob: data:",
    "connect-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
].join("; ");

/** The view position pdf.js reports on `updateviewarea`. */
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

function isCancellationError(error: unknown): boolean {
    return (
        error instanceof RenderingCancelledException ||
        (error instanceof Error && ["AbortException", "RenderingCancelledException"].includes(error.name))
    );
}

/** Wheel delta to zoom factor: exponential, so a step feels the same at every zoom level. */
export function getWheelZoomFactor(delta: number, deltaMode: number): number {
    const deltaScale = WHEEL_DELTA_SCALES[deltaMode] ?? 1;
    const factor = Math.exp(-delta * deltaScale * WHEEL_ZOOM_SENSITIVITY);

    return Math.min(MAX_WHEEL_ZOOM_FACTOR, Math.max(1 / MAX_WHEEL_ZOOM_FACTOR, factor));
}

export function installContentSecurityPolicy(document: Document): void {
    const meta = document.createElement("meta");
    meta.httpEquiv = "Content-Security-Policy";
    meta.content = CONTENT_SECURITY_POLICY;
    document.head.append(meta);
}

interface UsercontentWorker {
    worker: Worker;
    /** Resolves once pdf.js's worker code is running. */
    ready: Promise<void>;
}

/**
 * Start pdf.js's worker from a blob URL, the only same-origin URL an opaque origin has. Chromium will
 * not start a module worker from a blob URL here, so a classic bootstrap `import()`s it.
 */
export function createPdfWorker(workerSource: string): UsercontentWorker {
    const moduleUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    const bootstrap =
        `import(${JSON.stringify(moduleUrl)}).then(` +
        `() => self.postMessage(${JSON.stringify(WORKER_READY)}), ` +
        // Rethrow from a task so the failure surfaces as a worker error event.
        `(error) => setTimeout(() => { throw error; }));`;
    const worker = new Worker(URL.createObjectURL(new Blob([bootstrap], { type: "text/javascript" })));

    const ready = new Promise<void>((resolve, reject) => {
        const cleanup = (): void => {
            worker.removeEventListener("message", onMessage);
            worker.removeEventListener("error", onError);
        };
        const onMessage = (event: MessageEvent): void => {
            if (event.data !== WORKER_READY) return;
            cleanup();
            resolve();
        };
        const onError = (event: ErrorEvent): void => {
            cleanup();
            reject(event.error ?? new Error(event.message || "PDF worker failed to start"));
        };
        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", onError);
    });

    return { worker, ready };
}

interface OpenDocumentOptions {
    container: HTMLDivElement;
    viewer: HTMLDivElement;
    workerSource: string;
    post: (message: PdfUsercontentMessage) => void;
    data: ArrayBuffer;
    position?: PdfPosition;
}

interface PdfSession {
    goToPage(page: number): void;
}

function openDocument({ container, viewer, workerSource, post, data, position }: OpenDocumentOptions): PdfSession {
    let failed = false;
    const fail = (error: unknown): void => {
        if (failed || isCancellationError(error)) return;
        failed = true;
        post({ type: "error", message: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
    };

    const { worker, ready } = createPdfWorker(workerSource);
    worker.addEventListener("error", (event) => fail(event.error ?? new Error(event.message || "PDF worker failed")));

    const eventBus = new EventBus();
    const linkService = new ElementPdfLinkService({ eventBus });
    const pdfViewer = new PDFViewer({
        container,
        viewer,
        eventBus,
        linkService,
        // Links work, form fields are not inputs, and editing is off.
        annotationMode: AnnotationMode.ENABLE,
        annotationEditorMode: AnnotationEditorType.DISABLE,
        // Makes URLs in body text clickable, through the same link service.
        enableAutoLinking: true,
        maxCanvasPixels: MAX_CANVAS_PIXELS,
        maxCanvasDim: MAX_CANVAS_DIM,
    });
    linkService.setViewer(pdfViewer);

    // Positions reported before the saved one is applied belong to a fresh layout; don't report them.
    let isRestored = false;

    eventBus.on("pagesinit", () => {
        pdfViewer.currentScaleValue = FIT_TO_WIDTH;

        // pdf.js takes the saved position back as an `XYZ` destination, named scales included.
        if (position && position.page <= pdfViewer.pagesCount) {
            const scale = typeof position.scale === "number" ? position.scale / 100 : position.scale;
            pdfViewer.scrollPageIntoView({
                pageNumber: position.page,
                destArray: [null, { name: "XYZ" }, position.left, position.top, scale],
                allowNegativeOffset: true,
            });
        }

        isRestored = true;
        post({ type: "loaded", pageCount: pdfViewer.pagesCount, page: pdfViewer.currentPageNumber });
    });

    eventBus.on("pagechanging", ({ pageNumber }: { pageNumber: number }) => post({ type: "page", page: pageNumber }));

    eventBus.on("updateviewarea", ({ location }: { location?: PdfLocation | null }) => {
        if (!isRestored || !location) return;

        post({
            type: "position",
            position: { page: location.pageNumber, scale: location.scale, left: location.left, top: location.top },
        });
    });

    const load = async (): Promise<void> => {
        await ready;

        // pdf.js types `port` as `null` but accepts a Worker. With a port it never falls back to the main thread.
        const pdfWorker = new PDFWorker({ port: worker } as unknown as ConstructorParameters<typeof PDFWorker>[0]);
        const loadingTask = getDocument({
            data: new Uint8Array(data),
            worker: pdfWorker,
            stopAtErrors: true,
            maxImageSize: MAX_IMAGE_PIXELS,
            enableXfa: false,
            verbosity: VerbosityLevel.ERRORS,
        });
        const pdfDocument = await loadingTask.promise;

        pdfViewer.setDocument(pdfDocument);
        linkService.setDocument(pdfDocument, null);
    };
    void load().catch(fail);

    const zoomBy = (factor: number, clientPoint: [number, number]): void => {
        // pdf.js keeps the point under `origin` fixed, measured against the container's own offsets, so
        // translate the client point into the container's box and add those offsets back.
        const rect = container.getBoundingClientRect();
        const [offsetTop, offsetLeft] = pdfViewer.containerTopLeft;
        const origin: [number, number] = [
            clientPoint[0] - rect.left + offsetLeft,
            clientPoint[1] - rect.top + offsetTop,
        ];
        pdfViewer.updateScale({ scaleFactor: factor, origin, drawingDelay: ZOOM_DRAWING_DELAY });
    };

    container.addEventListener(
        "wheel",
        (event: WheelEvent) => {
            if (!event.ctrlKey && !event.metaKey) return;

            const delta = event.deltaY || event.deltaX;
            if (delta === 0) return;

            event.preventDefault();
            zoomBy(getWheelZoomFactor(delta, event.deltaMode), [event.clientX, event.clientY]);
        },
        { passive: false },
    );

    // Safari reports trackpad pinches as gesture events rather than ctrl+wheel.
    if ("ongesturechange" in window) {
        let lastGestureScale = 1;

        container.addEventListener("gesturestart", (event: Event) => {
            event.preventDefault();
            lastGestureScale = (event as GestureEvent).scale || 1;
        });
        container.addEventListener("gesturechange", (event: Event) => {
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
        });
        container.addEventListener("gestureend", (event: Event) => event.preventDefault());
    }

    if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(() => {
            // Re-applying a fit scale recomputes it for the new width.
            const scaleValue = pdfViewer.currentScaleValue;
            if (RESPONSIVE_SCALE_VALUES.has(scaleValue)) {
                pdfViewer.currentScaleValue = scaleValue;
            }
            pdfViewer.update();
        }).observe(container);
    }

    return {
        goToPage(page: number): void {
            if (page > pdfViewer.pagesCount) return;

            // Scrolls the page into view; pdf.js reports it back via `pagechanging`.
            pdfViewer.currentPageNumber = page;
        },
    };
}

export interface PdfUsercontentOptions {
    /** Source of pdf.js's worker module. */
    workerSource: string;
    /** Defaults to the global window. */
    win?: Window;
}

/** Lock the iframe down, then wait for the app to send a document. */
export function startPdfUsercontent({ workerSource, win = window }: PdfUsercontentOptions): void {
    installContentSecurityPolicy(win.document);

    // Opened directly rather than embedded.
    if (win.parent === win) return;

    const container = win.document.getElementById("container") as HTMLDivElement | null;
    const viewer = win.document.getElementById("viewer") as HTMLDivElement | null;
    if (!container || !viewer) throw new Error("PDF usercontent markup is missing");

    // A private channel: the app gets one end, and everything after `ready` travels over it.
    const { port1: port, port2 } = new MessageChannel();
    const post = (message: PdfUsercontentMessage): void => port.postMessage(message);

    let session: PdfSession | undefined;

    port.onmessage = (event: MessageEvent): void => {
        const message = parsePdfHostMessage(event.data);
        if (!message) return;

        switch (message.type) {
            case "load":
                if (session) return;
                session = openDocument({
                    container,
                    viewer,
                    workerSource,
                    post,
                    data: message.data,
                    position: message.position,
                });
                break;
            case "go_to_page":
                session?.goToPage(message.page);
                break;
        }
    };

    // Only the origin this page was served by may receive the port.
    const ready: PdfUsercontentMessage = { type: "ready" };
    win.parent.postMessage(ready, win.location.origin, [port2]);
}
