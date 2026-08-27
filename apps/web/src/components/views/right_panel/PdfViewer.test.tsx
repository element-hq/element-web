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
import type { UploadedMedia } from "@element-hq/element-web-module-api";

import { PdfViewer } from "./PdfViewer";

const pdfjsMock = vi.hoisted(() => ({
    getDocument: vi.fn(),
    GlobalWorkerOptions: {} as { workerSrc?: string },
}));

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
        public readonly setDocument = vi.fn();
        public readonly cleanup = vi.fn();
        public readonly update = vi.fn();
        public readonly updateScale = vi.fn();

        public constructor(public readonly options: { eventBus: MockEventBus; container: HTMLElement }) {
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

        #currentPageNumber = 1;
    }

    class MockPDFLinkService {
        public readonly setViewer = vi.fn();
        public readonly setDocument = vi.fn();
    }

    return { MockEventBus, MockPDFLinkService, MockPDFViewer };
});

vi.mock("pdfjs-dist", () => ({
    AnnotationEditorType: { DISABLE: -1 },
    AnnotationMode: { DISABLE: 0 },
    getDocument: pdfjsMock.getDocument,
    GlobalWorkerOptions: pdfjsMock.GlobalWorkerOptions,
    RenderingCancelledException: class extends Error {},
}));

vi.mock("pdfjs-dist/web/pdf_viewer.mjs", () => ({
    EventBus: viewerMock.MockEventBus,
    PDFLinkService: viewerMock.MockPDFLinkService,
    PDFViewer: viewerMock.MockPDFViewer,
}));

function media(name = "spec.pdf", body = "%PDF-1.7\n"): UploadedMedia {
    return {
        type: "uploaded",
        mimetype: "application/pdf",
        name,
        blob: vi.fn(async () => new Blob([body], { type: "application/pdf" })),
    };
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
    beforeEach(() => {
        pdfjsMock.getDocument.mockReset();
        pdfjsMock.GlobalWorkerOptions.workerSrc = undefined;
        viewerMock.MockPDFViewer.instances = [];
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
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

    it("builds the viewer read-only, with no annotation or editor layers", async () => {
        mockDocument();

        render(<PdfViewer media={media()} />);
        await emitPagesInit();

        expect(activeViewer().options).toMatchObject({ annotationMode: 0, annotationEditorMode: -1 });
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

    it("restores the scroll position when the same PDF is reopened", async () => {
        const selectedMedia = media();
        mockDocument();
        const { unmount } = render(<PdfViewer media={selectedMedia} />);
        await emitPagesInit();

        const container = screen.getByTestId("pdf-container");
        container.scrollLeft = 30;
        container.scrollTop = 420;
        fireEvent.scroll(container);
        unmount();

        mockDocument();
        render(<PdfViewer media={selectedMedia} />);
        await emitPagesInit();

        const reopened = screen.getByTestId("pdf-container");
        expect(reopened.scrollLeft).toBe(30);
        expect(reopened.scrollTop).toBe(420);
    });

    it("keeps scroll positions separate for different attachments", async () => {
        const first = media("first.pdf");
        mockDocument();
        const { unmount } = render(<PdfViewer media={first} />);
        await emitPagesInit();

        const container = screen.getByTestId("pdf-container");
        container.scrollTop = 900;
        fireEvent.scroll(container);
        unmount();

        mockDocument();
        render(<PdfViewer media={media("second.pdf")} />);
        await emitPagesInit();

        expect(screen.getByTestId("pdf-container").scrollTop).toBe(0);
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
});
