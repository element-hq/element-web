/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

import { PdfViewer } from "./PdfViewer";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import { flushPdfViewerState } from "../../../utils/pdfViewerState";
import { type PdfMedia } from "../../../@types/pdf-viewer";

const pdfjsMock = vi.hoisted(() => {
    /** Stands in for the browser's Worker, which the test environment does not have. */
    class MockWorker {
        public static instances: MockWorker[] = [];

        public readonly addEventListener = vi.fn();
        public readonly removeEventListener = vi.fn();
        public readonly terminate = vi.fn();

        public constructor(
            public readonly url: string,
            public readonly options?: WorkerOptions,
        ) {
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
        public readonly cleanup = vi.fn();
        public readonly update = vi.fn();
        public readonly updateScale = vi.fn();
        public readonly scrollPageIntoView = vi.fn();

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

vi.mock("../../../utils/pdfLinkService", () => ({
    ElementPdfLinkService: viewerMock.MockPDFLinkService,
}));

function media(name = "spec.pdf", body = "%PDF-1.7\n", uri = `mxc://example.org/${name}`, size?: number): PdfMedia {
    return {
        uri,
        name,
        size,
        blob: vi.fn(async () => new Blob([body], { type: "application/pdf" })),
    };
}

/** The Worker the component started for this document, once it has mounted. */
function activeWorker(): InstanceType<typeof pdfjsMock.MockWorker> {
    const worker = pdfjsMock.MockWorker.instances.at(-1);
    if (!worker) throw new Error("No Worker was constructed");
    return worker;
}

function mockDocument(): { loadingTask: PDFDocumentLoadingTask; pdfDocument: PDFDocumentProxy } {
    const loadingTask = { destroy: vi.fn(async () => {}) } as unknown as PDFDocumentLoadingTask;
    const pdfDocument = { numPages: 42 } as unknown as PDFDocumentProxy;

    Object.defineProperty(loadingTask, "promise", { value: Promise.resolve(pdfDocument) });
    pdfjsMock.getDocument.mockReturnValue(loadingTask);

    return { loadingTask, pdfDocument };
}

/** The viewer instance the component constructed, once it has mounted. */
function activeViewer(): InstanceType<typeof viewerMock.MockPDFViewer> {
    const viewer = viewerMock.MockPDFViewer.instances.at(-1);
    if (!viewer) throw new Error("No PDFViewer was constructed");
    return viewer;
}

/** pdf.js signals that pages are laid out and measurable via this event. */
async function emitPagesInit(): Promise<void> {
    await waitFor(() => expect(activeViewer().setDocument).toHaveBeenCalled());
    act(() => activeViewer().eventBus.dispatch("pagesinit"));
}

/** pdf.js re-reports the current page as the document scrolls. */
function emitPageChanging(pageNumber: number): void {
    act(() => activeViewer().eventBus.dispatch("pagechanging", { pageNumber }));
}

/** pdf.js reports the whole view position — page, zoom and offsets into that page — as it moves. */
function emitUpdateViewArea(location: { pageNumber: number; scale: number | string; left: number; top: number }): void {
    act(() => activeViewer().eventBus.dispatch("updateviewarea", { location }));
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
                disconnect: () => {
                    registration.elements.clear();
                    registrations.splice(registrations.indexOf(registration), 1);
                },
            };
        }) as unknown as typeof ResizeObserver,
    );

    return {
        trigger: (element) => {
            const matches = registrations.filter((registration) => registration.elements.has(element));

            for (const registration of matches) {
                registration.callback([{ target: element } as ResizeObserverEntry], {} as ResizeObserver);
            }
        },
    };
}

/** Positions are written out on unmount, but the setting write itself resolves a tick later. */
async function waitForStateWritten(name = "spec.pdf"): Promise<void> {
    await waitFor(() => expect(SettingsStore.getValue("pdfViewerState")[`mxc://example.org/${name}`]).toBeDefined());
}

function fireZoomWheel(deltaY: number, point: { x: number; y: number } = { x: 0, y: 0 }): void {
    const event = new Event("wheel", { bubbles: true, cancelable: true }) as WheelEvent;
    Object.defineProperties(event, {
        ctrlKey: { value: true },
        deltaX: { value: 0 },
        deltaY: { value: deltaY },
        clientX: { value: point.x },
        clientY: { value: point.y },
    });

    fireEvent(screen.getByTestId("pdf-container"), event);
}

describe("PdfViewer", () => {
    beforeEach(async () => {
        pdfjsMock.getDocument.mockReset();
        pdfjsMock.MockWorker.instances = [];
        pdfjsMock.MockPDFWorker.instances = [];
        viewerMock.MockPDFViewer.instances = [];
        vi.stubGlobal("Worker", pdfjsMock.MockWorker);

        flushPdfViewerState();
        await SettingsStore.setValue("pdfViewerState", null, SettingLevel.DEVICE, {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("opens the document with the untrusted-content protections pdf.js does not apply itself", async () => {
        mockDocument();

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pdfjsMock.getDocument).toHaveBeenCalled());
        // pdf.js defaults maxImageSize to -1, i.e. no limit, and logs at WARNINGS.
        expect(pdfjsMock.getDocument).toHaveBeenCalledWith(
            expect.objectContaining({
                maxImageSize: 8192 * 8192,
                enableXfa: false,
                stopAtErrors: true,
                verbosity: 0,
            }),
        );
    });

    it("parses the document in a worker it started itself, so pdf.js cannot fall back to the main thread", async () => {
        mockDocument();

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pdfjsMock.getDocument).toHaveBeenCalled());
        const worker = activeWorker();
        expect(worker.url).toMatch(/pdf\.worker/);
        expect(worker.options).toEqual({ type: "module" });

        // Given a port, pdf.js uses it as-is; it only sets up its "fake worker" when it made the worker.
        const pdfWorker = pdfjsMock.MockPDFWorker.instances.at(-1);
        expect(pdfWorker?.options).toEqual({ port: worker });
        expect(pdfjsMock.getDocument).toHaveBeenCalledWith(expect.objectContaining({ worker: pdfWorker }));
    });

    it("fails rather than degrading when the worker cannot run", async () => {
        mockDocument();

        render(<PdfViewer media={media()} />);

        await waitFor(() =>
            expect(activeWorker().addEventListener).toHaveBeenCalledWith("error", expect.any(Function)),
        );
        const onError = activeWorker().addEventListener.mock.calls.find(([name]) => name === "error")![1];
        act(() => onError({ message: "worker failed to load" }));

        expect(screen.getByRole("alert")).toHaveTextContent("Unable to load PDF");
    });

    it("stops its worker when the document is closed", async () => {
        const { loadingTask } = mockDocument();

        const { unmount } = render(<PdfViewer media={media()} />);
        await emitPagesInit();

        unmount();

        await waitFor(() => expect(activeWorker().terminate).toHaveBeenCalled());
        expect(loadingTask.destroy).toHaveBeenCalled();
        expect(pdfjsMock.MockPDFWorker.instances.at(-1)?.destroy).toHaveBeenCalled();
    });

    it("refuses a file the sender declares as too large without downloading it", async () => {
        mockDocument();
        const tooLarge = media("huge.pdf", "%PDF-1.7\n", "mxc://example.org/huge", 257 * 1024 * 1024);

        render(<PdfViewer media={tooLarge} />);

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to load PDF"));
        expect(tooLarge.blob).not.toHaveBeenCalled();
        expect(pdfjsMock.getDocument).not.toHaveBeenCalled();
    });

    it("refuses a file that turns out to be too large once downloaded", async () => {
        mockDocument();
        const claimedSmall = media("huge.pdf", "%PDF-1.7\n", "mxc://example.org/huge", 1024);
        vi.mocked(claimedSmall.blob).mockResolvedValue({
            size: 257 * 1024 * 1024,
            arrayBuffer: vi.fn(),
        } as unknown as Blob);

        render(<PdfViewer media={claimedSmall} />);

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to load PDF"));
        expect(pdfjsMock.getDocument).not.toHaveBeenCalled();
    });

    it("hands the loaded document to pdf.js's viewer and fits it to the panel width", async () => {
        const { pdfDocument } = mockDocument();

        render(<PdfViewer media={media()} />);

        expect(screen.getByRole("status")).toHaveTextContent("Loading PDF");

        await emitPagesInit();

        expect(activeViewer().setDocument).toHaveBeenCalledWith(pdfDocument);
        expect(activeViewer().currentScaleValue).toBe("page-width");
        await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    });

    it("builds the viewer read-only: links, but no form inputs, editing or scripting", async () => {
        mockDocument();

        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        // pdf.js defaults to ENABLE_FORMS, and derives scripting from the scriptingManager.
        expect(activeViewer().options).toMatchObject({
            annotationMode: 1,
            annotationEditorMode: -1,
            enableAutoLinking: true,
            maxCanvasPixels: 2 ** 25,
            maxCanvasDim: 32767,
        });
        expect(activeViewer().options).not.toHaveProperty("scriptingManager");
        expect(activeViewer().options).not.toHaveProperty("downloadManager");
        // External links are the app's decision, not pdf.js's defaults.
        expect(activeViewer().options.linkService).toBeInstanceOf(viewerMock.MockPDFLinkService);
    });

    it("zooms about the pointer, honouring the wheel delta magnitude", async () => {
        mockDocument();

        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        fireZoomWheel(-100, { x: 120, y: 240 });

        // A mouse notch is close to a 25% step; zoom is multiplicative so it is the same proportion
        // at any scale, and pdf.js keeps the point under `origin` fixed.
        expect(activeViewer().updateScale).toHaveBeenCalledWith(expect.objectContaining({ origin: [120, 240] }));
        expect(activeViewer().updateScale.mock.calls[0][0].scaleFactor).toBeCloseTo(1.246, 3);

        // A trackpad pinch arrives as small deltas and must not be quantised into a jump.
        fireZoomWheel(-10);
        expect(activeViewer().updateScale.mock.calls[1][0].scaleFactor).toBeCloseTo(1.022, 3);
    });

    it("ignores wheel events that are not a zoom gesture", async () => {
        mockDocument();

        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        const event = new Event("wheel", { bubbles: true, cancelable: true }) as WheelEvent;
        Object.defineProperties(event, {
            ctrlKey: { value: false },
            deltaX: { value: 0 },
            deltaY: { value: -100 },
        });
        fireEvent(screen.getByTestId("pdf-container"), event);

        expect(activeViewer().updateScale).not.toHaveBeenCalled();
    });

    it("re-fits to width when the panel is resized", async () => {
        const resize = mockResizeObserver();
        mockDocument();

        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        const container = screen.getByTestId("pdf-container");
        activeViewer().currentScaleValue = "page-width";
        resize.trigger(container);

        // Fit-to-width is relative to the container, so it has to be recomputed for the new width.
        expect(activeViewer().currentScaleValue).toBe("page-width");
        expect(activeViewer().update).toHaveBeenCalled();
    });

    it("leaves a manually chosen zoom alone when the panel is resized", async () => {
        const resize = mockResizeObserver();
        mockDocument();

        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        activeViewer().currentScaleValue = "1.75";
        resize.trigger(screen.getByTestId("pdf-container"));

        expect(activeViewer().currentScaleValue).toBe("1.75");
        expect(activeViewer().update).toHaveBeenCalled();
    });

    it("shows the current page and total, and follows the document as it is scrolled", async () => {
        mockDocument();

        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        expect(screen.getByTestId("pdf-page-input")).toHaveValue("1");
        expect(screen.getByTestId("pdf-page-total")).toHaveTextContent("100");

        // pdf.js reports the page it works out from the visible pages as the document scrolls.
        emitPageChanging(5);

        await waitFor(() => expect(screen.getByTestId("pdf-page-input")).toHaveValue("5"));
        expect(screen.getByRole("group")).toHaveAccessibleName("Page 5 of 100");
    });

    it("hides the page selector until the document is ready", () => {
        mockDocument();

        render(<PdfViewer media={media()} />);

        expect(screen.queryByTestId("pdf-page-input")).not.toBeInTheDocument();
    });

    it("jumps to a page typed into the selector", async () => {
        const user = userEvent.setup();
        mockDocument();

        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        const input = screen.getByTestId("pdf-page-input");
        await user.clear(input);
        await user.type(input, "42{Enter}");

        expect(activeViewer().currentPageNumber).toBe(42);
        await waitFor(() => expect(input).toHaveValue("42"));
    });

    it("reverts an out-of-range or unparseable page instead of jumping", async () => {
        const user = userEvent.setup();
        mockDocument();

        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        const input = screen.getByTestId("pdf-page-input");
        emitPageChanging(7);
        await waitFor(() => expect(input).toHaveValue("7"));

        await user.clear(input);
        await user.type(input, "500{Enter}");
        await waitFor(() => expect(input).toHaveValue("7"));

        await user.clear(input);
        await user.type(input, "abc{Enter}");
        await waitFor(() => expect(input).toHaveValue("7"));

        expect(activeViewer().currentPageNumber).toBe(1);
    });

    it("does not overwrite the box while it is being edited", async () => {
        const user = userEvent.setup();
        mockDocument();

        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        const input = screen.getByTestId("pdf-page-input");
        await user.clear(input);
        await user.type(input, "12");

        // Scrolling continues to report pages, but must not clobber a half-typed entry.
        emitPageChanging(3);

        expect(input).toHaveValue("12");
    });

    it("abandons an edit on Escape", async () => {
        const user = userEvent.setup();
        mockDocument();

        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        const input = screen.getByTestId("pdf-page-input");
        emitPageChanging(9);
        await waitFor(() => expect(input).toHaveValue("9"));

        await user.clear(input);
        await user.type(input, "40{Escape}");

        await waitFor(() => expect(input).toHaveValue("9"));
        expect(activeViewer().currentPageNumber).toBe(1);
    });

    it("restores the reading position when the same PDF is reopened", async () => {
        mockDocument();
        const { unmount } = render(<PdfViewer media={media()} />);
        await emitPagesInit();

        emitUpdateViewArea({ pageNumber: 12, scale: 150, left: 40, top: 260 });
        unmount();
        await waitForStateWritten();

        // Switching rooms rebuilds the media handle from the event, so the viewer is handed a fresh
        // object for the same file — the position has to be keyed on the MXC URI, not the object.
        mockDocument();
        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        expect(activeViewer().scrollPageIntoView).toHaveBeenCalledWith({
            pageNumber: 12,
            // pdf.js reports the zoom as a percentage but takes it back as a factor.
            destArray: [null, { name: "XYZ" }, 40, 260, 1.5],
            allowNegativeOffset: true,
        });
    });

    it("restores a fit-to-panel zoom by name, so it is recomputed for the new panel", async () => {
        mockDocument();
        const { unmount } = render(<PdfViewer media={media()} />);
        await emitPagesInit();

        emitUpdateViewArea({ pageNumber: 3, scale: "page-width", left: 0, top: 80 });
        unmount();
        await waitForStateWritten();

        mockDocument();
        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        expect(activeViewer().scrollPageIntoView).toHaveBeenCalledWith(
            expect.objectContaining({ destArray: [null, { name: "XYZ" }, 0, 80, "page-width"] }),
        );
    });

    it("keeps reading positions separate for different attachments", async () => {
        mockDocument();
        const { unmount } = render(<PdfViewer media={media("first.pdf")} />);
        await emitPagesInit();

        emitUpdateViewArea({ pageNumber: 30, scale: 100, left: 0, top: 900 });
        unmount();
        await waitForStateWritten("first.pdf");

        mockDocument();
        render(<PdfViewer media={media("second.pdf")} />);
        await emitPagesInit();

        expect(activeViewer().scrollPageIntoView).not.toHaveBeenCalled();
    });

    it("ignores a saved page that the document no longer has", async () => {
        mockDocument();
        const { unmount } = render(<PdfViewer media={media()} />);
        await emitPagesInit();

        emitUpdateViewArea({ pageNumber: 500, scale: 100, left: 0, top: 0 });
        unmount();
        await waitForStateWritten();

        mockDocument();
        render(<PdfViewer media={media()} />);
        // The mock viewer reports 100 pages, so page 500 cannot be scrolled to.
        await emitPagesInit();

        expect(activeViewer().scrollPageIntoView).not.toHaveBeenCalled();
    });

    it("does not record the layout position pdf.js reports before the saved one is applied", async () => {
        mockDocument();
        const { unmount } = render(<PdfViewer media={media()} />);
        await emitPagesInit();

        emitUpdateViewArea({ pageNumber: 12, scale: 150, left: 40, top: 260 });
        unmount();
        await waitForStateWritten();

        mockDocument();
        const reopened = render(<PdfViewer media={media()} />);
        // A fresh layout reports page 1 before `pagesinit` restores anything; that must not win.
        emitUpdateViewArea({ pageNumber: 1, scale: "page-width", left: 0, top: 0 });
        await emitPagesInit();
        reopened.unmount();
        await waitForStateWritten();

        mockDocument();
        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        expect(activeViewer().scrollPageIntoView).toHaveBeenCalledWith(expect.objectContaining({ pageNumber: 12 }));
    });

    it("releases pdf.js resources on unmount", async () => {
        const { loadingTask } = mockDocument();
        const { unmount } = render(<PdfViewer media={media()} />);
        await emitPagesInit();

        const viewer = activeViewer();
        unmount();

        expect(viewer.cleanup).toHaveBeenCalled();
        expect(viewer.setDocument).toHaveBeenLastCalledWith(null);
        await waitFor(() => expect(loadingTask.destroy).toHaveBeenCalled());
    });

    it("shows a clear error when the PDF cannot be loaded", async () => {
        const loadingTask = { destroy: vi.fn(async () => {}) } as unknown as PDFDocumentLoadingTask;
        Object.defineProperty(loadingTask, "promise", { value: Promise.reject(new Error("bad pdf")) });
        pdfjsMock.getDocument.mockReturnValue(loadingTask);

        render(<PdfViewer media={media("broken.pdf")} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load PDF.");
    });

    it("shows a clear error when the attachment is empty", async () => {
        mockDocument();

        render(<PdfViewer media={media("empty.pdf", "")} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load PDF.");
    });

    it("rejects an attachment with no PDF signature without handing it to pdf.js", async () => {
        mockDocument();

        render(<PdfViewer media={media("not-really.pdf", "GIF89a this is not a PDF at all")} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load PDF.");
        expect(pdfjsMock.getDocument).not.toHaveBeenCalled();
    });

    it("accepts a signature that is not at the very start, as pdf.js does", async () => {
        const { pdfDocument } = mockDocument();

        // pdf.js searches the first 1024 bytes rather than demanding the header at offset 0, so a file
        // with leading junk still opens there and must still open here.
        render(<PdfViewer media={media("padded.pdf", "\n\n%PDF-1.7\n")} />);

        await waitFor(() => expect(activeViewer().setDocument).toHaveBeenCalledWith(pdfDocument));
    });

    it("rejects a signature sitting beyond the range pdf.js searches", async () => {
        mockDocument();

        render(<PdfViewer media={media("late.pdf", "x".repeat(2000) + "%PDF-1.7\n")} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load PDF.");
        expect(pdfjsMock.getDocument).not.toHaveBeenCalled();
    });
});
