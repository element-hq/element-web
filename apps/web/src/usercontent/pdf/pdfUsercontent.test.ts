/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

import { createPdfWorker, getWheelZoomFactor, startPdfUsercontent } from "./pdfUsercontent";
import { type PdfHostMessage, type PdfPosition, type PdfUsercontentMessage } from "./protocol";

const pdfjsMock = vi.hoisted(() => {
    /** The test environment has no Worker. */
    class MockWorker extends EventTarget {
        public static instances: MockWorker[] = [];

        public readonly postMessage = vi.fn();
        public readonly terminate = vi.fn();

        public constructor(
            public readonly url: string,
            public readonly options?: WorkerOptions,
        ) {
            super();
            MockWorker.instances.push(this);
        }
    }

    class MockPDFWorker {
        public static instances: MockPDFWorker[] = [];

        public readonly destroy = vi.fn();

        public constructor(public readonly options: { port?: unknown }) {
            MockPDFWorker.instances.push(this);
        }
    }

    return {
        getDocument: vi.fn(),
        MockWorker,
        MockPDFWorker,
    };
});

const viewerMock = vi.hoisted(() => {
    type Listener = (payload: unknown) => void;

    class MockEventBus {
        private readonly listeners = new Map<string, Set<Listener>>();

        public on(name: string, listener: Listener): void {
            if (!this.listeners.has(name)) this.listeners.set(name, new Set());
            this.listeners.get(name)!.add(listener);
        }

        public off(name: string, listener: Listener): void {
            this.listeners.get(name)?.delete(listener);
        }

        public dispatch(name: string, payload: unknown = {}): void {
            const listeners = Array.from(this.listeners.get(name) ?? []);
            for (const listener of listeners) listener(payload);
        }
    }

    class MockPDFViewer {
        public static instances: MockPDFViewer[] = [];

        public currentScaleValue = "";
        public pagesCount = 100;
        #currentPageNumber = 1;
        public readonly setDocument = vi.fn();
        public readonly update = vi.fn();
        public readonly updateScale = vi.fn();
        public readonly scrollPageIntoView = vi.fn();
        public readonly cleanup = vi.fn();
        // What pdf.js measures zoom origins against: the container's `offsetTop`/`offsetLeft`.
        public containerTopLeft = [0, 0];

        public constructor(
            public readonly options: { eventBus: MockEventBus; container: HTMLElement; linkService?: unknown },
        ) {
            MockPDFViewer.instances.push(this);
        }

        public get eventBus(): MockEventBus {
            return this.options.eventBus;
        }

        // Assigning this scrolls pdf.js to the page, which then reports back via `pagechanging`.
        public set currentPageNumber(pageNumber: number) {
            this.#currentPageNumber = pageNumber;
            this.options.eventBus.dispatch("pagechanging", { pageNumber });
        }

        public get currentPageNumber(): number {
            return this.#currentPageNumber;
        }
    }

    class MockPDFLinkService {
        public readonly setViewer = vi.fn();
        public readonly setDocument = vi.fn();
    }

    return { MockEventBus, MockPDFLinkService, MockPDFViewer };
});

vi.mock("pdfjs-dist", () => ({
    AnnotationEditorType: { DISABLE: -1 },
    AnnotationMode: { DISABLE: 0, ENABLE: 1, ENABLE_FORMS: 2 },
    getDocument: pdfjsMock.getDocument,
    PDFWorker: pdfjsMock.MockPDFWorker,
    RenderingCancelledException: class extends Error {},
    VerbosityLevel: { ERRORS: 0, WARNINGS: 1, INFOS: 5 },
}));

vi.mock("pdfjs-dist/web/pdf_viewer.mjs", () => ({
    EventBus: viewerMock.MockEventBus,
    PDFViewer: viewerMock.MockPDFViewer,
}));

vi.mock("./linkService", () => ({
    ElementPdfLinkService: viewerMock.MockPDFLinkService,
}));

const WORKER_SOURCE = "/* pdf.js worker */ export {};";
const ORIGIN = "http://localhost";

/** Every Blob handed to `URL.createObjectURL`, in order. */
let objectUrlBlobs: Blob[] = [];

/** One end of the channel the iframe opens. Messages are delivered by calling `onmessage` directly. */
interface FakePort {
    postMessage: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
    close: ReturnType<typeof vi.fn>;
}

function fakePort(): FakePort {
    return { postMessage: vi.fn(), onmessage: null, close: vi.fn() };
}

class MockMessageChannel {
    public static instances: MockMessageChannel[] = [];

    public readonly port1 = fakePort();
    public readonly port2 = fakePort();

    public constructor() {
        MockMessageChannel.instances.push(this);
    }
}

/** A stand-in for the iframe's window, with a recording parent. */
interface FakeIframe {
    win: Window;
    parent: { postMessage: ReturnType<typeof vi.fn> };
    /** The iframe's end of the channel it opened. */
    channel(): MockMessageChannel;
    /** Deliver a message from the app over the channel. */
    receive(data: unknown): void;
    /** Everything the iframe sent to the app over the channel. */
    posted(): PdfUsercontentMessage[];
    /** Unload the page, as closing the iframe does. */
    hide(): void;
}

function fakeIframe({ embedded = true }: { embedded?: boolean } = {}): FakeIframe {
    document.head.replaceChildren();
    document.body.innerHTML = `<div id="container"><div id="viewer" class="pdfViewer"></div></div>`;

    const parent = { postMessage: vi.fn() };
    const windowListeners = new Map<string, () => void>();
    const win = {
        document,
        location: { origin: ORIGIN },
        parent: undefined as unknown,
        addEventListener: (type: string, listener: () => void) => windowListeners.set(type, listener),
    };
    win.parent = embedded ? parent : win;

    const channel = (): MockMessageChannel => {
        const instance = MockMessageChannel.instances.at(-1);
        if (!instance) throw new Error("No MessageChannel was opened");
        return instance;
    };

    return {
        win: win as unknown as Window,
        parent,
        channel,
        receive: (data) => channel().port1.onmessage?.({ data } as MessageEvent),
        posted: () => channel().port1.postMessage.mock.calls.map(([message]) => message as PdfUsercontentMessage),
        hide: () => windowListeners.get("pagehide")?.(),
    };
}

/** The worker started for this document. */
function activeWorker(): InstanceType<typeof pdfjsMock.MockWorker> {
    const worker = pdfjsMock.MockWorker.instances.at(-1);
    if (!worker) throw new Error("No Worker was constructed");
    return worker;
}

/** The viewer constructed for this document. */
function activeViewer(): InstanceType<typeof viewerMock.MockPDFViewer> {
    const viewer = viewerMock.MockPDFViewer.instances.at(-1);
    if (!viewer) throw new Error("No PDFViewer was constructed");
    return viewer;
}

function mockDocument(): { loadingTask: PDFDocumentLoadingTask; pdfDocument: PDFDocumentProxy } {
    const loadingTask = { destroy: vi.fn(async () => {}) } as unknown as PDFDocumentLoadingTask;
    const pdfDocument = { numPages: 42 } as unknown as PDFDocumentProxy;

    Object.defineProperty(loadingTask, "promise", { value: Promise.resolve(pdfDocument) });
    pdfjsMock.getDocument.mockReturnValue(loadingTask);

    return { loadingTask, pdfDocument };
}

function loadMessage(position?: PdfPosition): PdfHostMessage {
    return { type: "load", data: new TextEncoder().encode("%PDF-1.7\n").buffer as ArrayBuffer, position };
}

/** The bootstrap reports pdf.js's worker module loaded. */
function emitWorkerReady(): void {
    activeWorker().dispatchEvent(new MessageEvent("message", { data: "io.element.pdf.worker_ready" }));
}

async function waitForDocument(): Promise<void> {
    await vi.waitFor(() => expect(activeViewer().setDocument).toHaveBeenCalled());
}

/** Start, load and lay out. */
async function openDocument(iframe: FakeIframe, position?: PdfPosition): Promise<void> {
    mockDocument();
    startPdfUsercontent({ workerSource: WORKER_SOURCE, win: iframe.win });
    iframe.receive(loadMessage(position));
    emitWorkerReady();
    await waitForDocument();
    activeViewer().eventBus.dispatch("pagesinit");
}

function fireZoomWheel(deltaY: number, point: { x: number; y: number } = { x: 0, y: 0 }, ctrlKey = true): void {
    const event = new Event("wheel", { bubbles: true, cancelable: true }) as WheelEvent;
    Object.defineProperties(event, {
        ctrlKey: { value: ctrlKey },
        deltaX: { value: 0 },
        deltaY: { value: deltaY },
        deltaMode: { value: 0 },
        clientX: { value: point.x },
        clientY: { value: point.y },
    });

    document.getElementById("container")!.dispatchEvent(event);
}

function mockResizeObserver(): { trigger: (element: Element) => void } {
    interface Registration {
        callback: ResizeObserverCallback;
        elements: Set<Element>;
    }

    const registrations: Registration[] = [];

    vi.stubGlobal(
        "ResizeObserver",
        vi.fn(function (callback: ResizeObserverCallback) {
            const registration: Registration = { callback, elements: new Set() };
            registrations.push(registration);

            return {
                observe: (element: Element) => registration.elements.add(element),
                unobserve: (element: Element) => registration.elements.delete(element),
                disconnect: () => registrations.splice(registrations.indexOf(registration), 1),
            };
        }) as unknown as typeof ResizeObserver,
    );

    return {
        trigger: (element) => {
            for (const registration of registrations.filter((registration) => registration.elements.has(element))) {
                registration.callback([{ target: element } as ResizeObserverEntry], {} as ResizeObserver);
            }
        },
    };
}

describe("PDF usercontent", () => {
    beforeEach(() => {
        pdfjsMock.getDocument.mockReset();
        pdfjsMock.MockWorker.instances = [];
        pdfjsMock.MockPDFWorker.instances = [];
        viewerMock.MockPDFViewer.instances = [];
        MockMessageChannel.instances = [];
        vi.stubGlobal("Worker", pdfjsMock.MockWorker);
        vi.stubGlobal("MessageChannel", MockMessageChannel);

        objectUrlBlobs = [];
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn() });
        Object.defineProperty(URL, "createObjectURL", {
            configurable: true,
            writable: true,
            value: vi.fn((blob: Blob) => {
                objectUrlBlobs.push(blob);
                return `blob:null/${objectUrlBlobs.length}`;
            }),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe("startup", () => {
        it("locks the iframe down before anything else, and then says it is ready", () => {
            const iframe = fakeIframe();

            startPdfUsercontent({ workerSource: WORKER_SOURCE, win: iframe.win });

            const policy = document.head.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]');
            const directives = policy!.content.split(";").map((directive) => directive.trim());
            // No network at all.
            expect(directives).toEqual(
                expect.arrayContaining([
                    "default-src 'none'",
                    "connect-src 'none'",
                    "frame-src 'none'",
                    "form-action 'none'",
                ]),
            );
            // 'self' means nothing for an opaque origin, and WebKit refuses it.
            expect(policy!.content).not.toContain("'self'");
            // What pdf.js needs.
            expect(directives).toEqual(
                expect.arrayContaining(["worker-src blob:", "script-src blob:", "style-src 'unsafe-inline'"]),
            );

            // `ready` carries the app's end of the channel, addressed to the app's origin and nobody else's.
            expect(iframe.parent.postMessage).toHaveBeenCalledExactlyOnceWith({ type: "ready" }, ORIGIN, [
                iframe.channel().port2,
            ]);
            expect(iframe.posted()).toEqual([]);
        });

        it("does nothing when opened directly rather than embedded", () => {
            const iframe = fakeIframe({ embedded: false });

            startPdfUsercontent({ workerSource: WORKER_SOURCE, win: iframe.win });

            expect(iframe.parent.postMessage).not.toHaveBeenCalled();
            expect(MockMessageChannel.instances).toEqual([]);
        });

        it("ignores messages that do not fit the protocol", () => {
            const iframe = fakeIframe();
            mockDocument();
            startPdfUsercontent({ workerSource: WORKER_SOURCE, win: iframe.win });

            iframe.receive({ type: "load", data: "not bytes" });
            iframe.receive({ type: "go_to_page", page: "2" });
            iframe.receive("load");

            expect(pdfjsMock.MockWorker.instances).toHaveLength(0);
            expect(viewerMock.MockPDFViewer.instances).toHaveLength(0);
        });
    });

    describe("worker", () => {
        it("starts pdf.js's worker from the iframe's own origin", async () => {
            const { worker: started, ready } = createPdfWorker(WORKER_SOURCE);
            const worker = started as unknown as InstanceType<typeof pdfjsMock.MockWorker>;

            // A blob of the bundled source, imported by a classic bootstrap (Chromium refuses blob module workers).
            expect(worker.options).toBeUndefined();
            expect(worker.url).toBe("blob:null/2");
            await expect(objectUrlBlobs[0].text()).resolves.toBe(WORKER_SOURCE);
            const bootstrap = await objectUrlBlobs[1].text();
            expect(bootstrap).toContain('import("blob:null/1")');

            let isReady = false;
            void ready.then(() => (isReady = true));
            await Promise.resolve();
            expect(isReady).toBe(false);

            emitWorkerReady();
            await expect(ready).resolves.toBeUndefined();
            // Both blobs are released once the worker has loaded.
            expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:null/1");
            expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:null/2");
        });

        it("rejects if the worker fails to start", async () => {
            const { ready } = createPdfWorker(WORKER_SOURCE);

            activeWorker().dispatchEvent(new ErrorEvent("error", { message: "import failed" }));

            await expect(ready).rejects.toThrow("import failed");
        });
    });

    describe("loading", () => {
        it("parses the document in its own worker, with the protections pdf.js does not apply itself", async () => {
            const iframe = fakeIframe();
            const { pdfDocument } = mockDocument();
            startPdfUsercontent({ workerSource: WORKER_SOURCE, win: iframe.win });

            iframe.receive(loadMessage());
            // Nothing reaches pdf.js until the worker is confirmed running.
            await Promise.resolve();
            expect(pdfjsMock.getDocument).not.toHaveBeenCalled();

            emitWorkerReady();
            await waitForDocument();

            expect(pdfjsMock.MockPDFWorker.instances.at(-1)?.options).toEqual({ port: activeWorker() });
            expect(pdfjsMock.getDocument).toHaveBeenCalledWith(
                expect.objectContaining({
                    worker: pdfjsMock.MockPDFWorker.instances.at(-1),
                    maxImageSize: 8192 * 8192,
                    enableXfa: false,
                    stopAtErrors: true,
                    verbosity: 0,
                }),
            );
            const data = pdfjsMock.getDocument.mock.calls[0][0].data as Uint8Array;
            expect(new TextDecoder().decode(data)).toBe("%PDF-1.7\n");
            expect(activeViewer().setDocument).toHaveBeenCalledWith(pdfDocument);
        });

        it("builds the viewer read-only: links, but no form inputs, editing or scripting", async () => {
            const iframe = fakeIframe();
            await openDocument(iframe);

            expect(activeViewer().options).toMatchObject({
                annotationMode: 1,
                annotationEditorMode: -1,
                enableAutoLinking: true,
                maxCanvasPixels: 2 ** 25,
                maxCanvasDim: 32767,
            });
            expect(activeViewer().options).not.toHaveProperty("scriptingManager");
            expect(activeViewer().options).not.toHaveProperty("downloadManager");
            expect(activeViewer().options.linkService).toBeInstanceOf(viewerMock.MockPDFLinkService);
            expect(activeViewer().options.container).toBe(document.getElementById("container"));
        });

        it("shows one document per iframe", async () => {
            const iframe = fakeIframe();
            await openDocument(iframe);

            iframe.receive(loadMessage());

            expect(pdfjsMock.MockWorker.instances).toHaveLength(1);
            expect(viewerMock.MockPDFViewer.instances).toHaveLength(1);
        });

        it("reports a worker that cannot run rather than degrading", async () => {
            const iframe = fakeIframe();
            mockDocument();
            startPdfUsercontent({ workerSource: WORKER_SOURCE, win: iframe.win });
            iframe.receive(loadMessage());

            activeWorker().dispatchEvent(new ErrorEvent("error", { message: "worker failed to load" }));

            await vi.waitFor(() =>
                expect(iframe.posted()).toContainEqual({ type: "error", message: "Error: worker failed to load" }),
            );
            expect(pdfjsMock.getDocument).not.toHaveBeenCalled();
        });

        it("reports a document pdf.js cannot open", async () => {
            const iframe = fakeIframe();
            const loadingTask = { destroy: vi.fn(async () => {}) } as unknown as PDFDocumentLoadingTask;
            Object.defineProperty(loadingTask, "promise", { value: Promise.reject(new Error("bad pdf")) });
            pdfjsMock.getDocument.mockReturnValue(loadingTask);
            startPdfUsercontent({ workerSource: WORKER_SOURCE, win: iframe.win });

            iframe.receive(loadMessage());
            emitWorkerReady();

            await vi.waitFor(() =>
                expect(iframe.posted()).toContainEqual({ type: "error", message: "Error: bad pdf" }),
            );
        });

        it("reports a failure once, and never a cancellation", async () => {
            const iframe = fakeIframe();
            await openDocument(iframe);

            const abort = new Error("aborted");
            abort.name = "AbortException";
            activeWorker().dispatchEvent(new ErrorEvent("error", { error: abort, message: "aborted" }));
            activeWorker().dispatchEvent(new ErrorEvent("error", { message: "first" }));
            activeWorker().dispatchEvent(new ErrorEvent("error", { message: "second" }));

            const errors = iframe.posted().filter((message) => message.type === "error");
            expect(errors).toEqual([{ type: "error", message: "Error: first" }]);
        });
    });

    describe("layout", () => {
        it("fits the document to the iframe and tells the app it is ready", async () => {
            const iframe = fakeIframe();
            await openDocument(iframe);

            expect(activeViewer().currentScaleValue).toBe("page-width");
            expect(iframe.posted()).toContainEqual({ type: "loaded", pageCount: 100, page: 1 });
        });

        it("restores a saved position before reporting anything", async () => {
            const iframe = fakeIframe();
            mockDocument();
            startPdfUsercontent({ workerSource: WORKER_SOURCE, win: iframe.win });
            iframe.receive(loadMessage({ page: 12, scale: 150, left: 40, top: 260 }));
            emitWorkerReady();
            await waitForDocument();

            // A fresh layout reports page 1 before `pagesinit`; it must not reach the app.
            activeViewer().eventBus.dispatch("updateviewarea", {
                location: { pageNumber: 1, scale: "page-width", left: 0, top: 0 },
            });
            expect(iframe.posted().filter((message) => message.type === "position")).toEqual([]);

            activeViewer().eventBus.dispatch("pagesinit");

            expect(activeViewer().scrollPageIntoView).toHaveBeenCalledWith({
                pageNumber: 12,
                // pdf.js reports the zoom as a percentage but takes it back as a factor.
                destArray: [null, { name: "XYZ" }, 40, 260, 1.5],
                allowNegativeOffset: true,
            });
        });

        it("restores a fit-to-width zoom by name, so it is recomputed for this iframe", async () => {
            const iframe = fakeIframe();
            await openDocument(iframe, { page: 3, scale: "page-width", left: 0, top: 80 });

            expect(activeViewer().scrollPageIntoView).toHaveBeenCalledWith(
                expect.objectContaining({ destArray: [null, { name: "XYZ" }, 0, 80, "page-width"] }),
            );
        });

        it("ignores a saved page that the document no longer has", async () => {
            const iframe = fakeIframe();
            await openDocument(iframe, { page: 500, scale: 100, left: 0, top: 0 });

            expect(activeViewer().scrollPageIntoView).not.toHaveBeenCalled();
        });

        it("reports the current page and the reading position as the document moves", async () => {
            const iframe = fakeIframe();
            await openDocument(iframe);

            activeViewer().eventBus.dispatch("pagechanging", { pageNumber: 5 });
            activeViewer().eventBus.dispatch("updateviewarea", {
                location: { pageNumber: 5, scale: 123.45, left: 10, top: 20 },
            });
            activeViewer().eventBus.dispatch("updateviewarea", { location: null });

            expect(iframe.posted()).toContainEqual({ type: "page", page: 5 });
            expect(iframe.posted().filter((message) => message.type === "position")).toEqual([
                { type: "position", position: { page: 5, scale: 123.45, left: 10, top: 20 } },
            ]);
        });

        it("jumps to a page the app asks for, if the document has it", async () => {
            const iframe = fakeIframe();
            await openDocument(iframe);

            iframe.receive({ type: "go_to_page", page: 42 });
            expect(activeViewer().currentPageNumber).toBe(42);

            iframe.receive({ type: "go_to_page", page: 500 });
            expect(activeViewer().currentPageNumber).toBe(42);
        });
    });

    describe("zoom and resize", () => {
        it("zooms about the pointer, honouring the wheel delta magnitude", async () => {
            const iframe = fakeIframe();
            await openDocument(iframe);

            // pdf.js measures the origin against the container's offsets, so the pointer is translated into
            // the container's box (120, 240) and then has those offsets added back.
            const container = document.getElementById("container")!;
            vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
                left: 800,
                top: 100,
                width: 400,
                height: 600,
            } as DOMRect);
            activeViewer().containerTopLeft = [10, 20];

            fireZoomWheel(-100, { x: 920, y: 340 });

            // A mouse notch is close to a 25% step.
            expect(activeViewer().updateScale).toHaveBeenCalledWith(expect.objectContaining({ origin: [140, 250] }));
            expect(activeViewer().updateScale.mock.calls[0][0].scaleFactor).toBeCloseTo(1.246, 3);

            // A trackpad pinch arrives as small deltas.
            fireZoomWheel(-10);
            expect(activeViewer().updateScale.mock.calls[1][0].scaleFactor).toBeCloseTo(1.022, 3);
        });

        it("ignores wheel events that are not a zoom gesture", async () => {
            const iframe = fakeIframe();
            await openDocument(iframe);

            fireZoomWheel(-100, { x: 0, y: 0 }, false);

            expect(activeViewer().updateScale).not.toHaveBeenCalled();
        });

        it("clamps a single wheel step", () => {
            expect(getWheelZoomFactor(-100000, 0)).toBe(1.5);
            expect(getWheelZoomFactor(100000, 0)).toBeCloseTo(1 / 1.5, 6);
            // Line and page delta modes are scaled up.
            expect(getWheelZoomFactor(-1, 1)).toBeGreaterThan(getWheelZoomFactor(-1, 0));
        });

        it("re-fits to width when the iframe is resized, but leaves a chosen zoom alone", async () => {
            const resize = mockResizeObserver();
            const iframe = fakeIframe();
            await openDocument(iframe);
            const container = document.getElementById("container")!;

            activeViewer().currentScaleValue = "page-width";
            resize.trigger(container);
            expect(activeViewer().currentScaleValue).toBe("page-width");
            expect(activeViewer().update).toHaveBeenCalledTimes(1);

            activeViewer().currentScaleValue = "1.75";
            resize.trigger(container);
            expect(activeViewer().currentScaleValue).toBe("1.75");
            expect(activeViewer().update).toHaveBeenCalledTimes(2);
        });

        it("releases everything when the page is hidden", async () => {
            const resize = mockResizeObserver();
            const iframe = fakeIframe();
            await openDocument(iframe);
            const container = document.getElementById("container")!;
            const loadingTask = pdfjsMock.getDocument.mock.results[0].value as PDFDocumentLoadingTask;

            iframe.hide();

            // Listeners and observer are gone.
            fireZoomWheel(-100);
            resize.trigger(container);
            expect(activeViewer().updateScale).not.toHaveBeenCalled();
            expect(activeViewer().update).not.toHaveBeenCalled();
            // pdf.js is torn down, the worker stopped and the channel closed.
            expect(activeViewer().cleanup).toHaveBeenCalled();
            expect(activeViewer().setDocument).toHaveBeenLastCalledWith(null);
            expect(loadingTask.destroy).toHaveBeenCalled();
            expect(pdfjsMock.MockPDFWorker.instances.at(-1)?.destroy).toHaveBeenCalled();
            expect(activeWorker().terminate).toHaveBeenCalled();
            expect(iframe.channel().port1.close).toHaveBeenCalled();
        });
    });
});
