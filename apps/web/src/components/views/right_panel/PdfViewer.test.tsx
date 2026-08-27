/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "test-utils-rtl";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import type { UploadedMedia } from "@element-hq/element-web-module-api";

import { PDF_VIEWER_MAX_ZOOM, PDF_VIEWER_MIN_ZOOM, PDF_VIEWER_ZOOM_RENDER_DEBOUNCE_MS, PdfViewer } from "./PdfViewer";

const pdfjsMock = vi.hoisted(() => {
    class MockRenderingCancelledException extends Error {
        public constructor() {
            super("cancelled");
            this.name = "RenderingCancelledException";
        }
    }

    class MockTextLayer {
        public static cleanup = vi.fn();
        public readonly cancel = vi.fn();
        public readonly render = vi.fn(async () => {
            const span = document.createElement("span");
            span.textContent = "Selectable PDF text";
            this.container.append(span);
        });

        public constructor(private readonly options: { container: HTMLElement }) {}

        private get container(): HTMLElement {
            return this.options.container;
        }
    }

    return {
        getDocument: vi.fn(),
        GlobalWorkerOptions: {} as { workerSrc?: string },
        MockRenderingCancelledException,
        MockTextLayer,
    };
});

vi.mock("pdfjs-dist", () => ({
    getDocument: pdfjsMock.getDocument,
    GlobalWorkerOptions: pdfjsMock.GlobalWorkerOptions,
    RenderingCancelledException: pdfjsMock.MockRenderingCancelledException,
    TextLayer: pdfjsMock.MockTextLayer,
}));

function media(name = "spec.pdf", body = "%PDF-1.7\n"): UploadedMedia {
    return {
        type: "uploaded",
        mimetype: "application/pdf",
        name,
        blob: vi.fn(async () => new Blob([body], { type: "application/pdf" })),
    };
}

function createRenderTask(): RenderTask {
    return {
        cancel: vi.fn(),
        promise: Promise.resolve(),
        onContinue: undefined,
    } as unknown as RenderTask;
}

function createPendingRenderTask(): RenderTask {
    let rejectRender!: (error: Error) => void;
    const promise = new Promise<void>((_, reject) => {
        rejectRender = reject;
    });

    return {
        cancel: vi.fn(() => rejectRender(new pdfjsMock.MockRenderingCancelledException())),
        promise,
        onContinue: undefined,
    } as unknown as RenderTask;
}

/** Zoom is no longer surfaced as a label, so read it from the variable the pages are scaled by. */
function getDisplayZoom(): number {
    return Number.parseFloat(screen.getByTestId("pdf-pages").style.getPropertyValue("--pdf-display-zoom"));
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

    fireEvent(screen.getByTestId("pdf-viewer"), event);
}

/** Applies coalesced zoom immediately, so tests that need real timers do not have to wait a frame. */
function stubSynchronousAnimationFrame(): void {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
}

async function flushPromises(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

interface IntersectionControl {
    setNear: (element: Element, isIntersecting: boolean) => void;
    setRetained: (element: Element, isIntersecting: boolean) => void;
}

const RENDER_ROOT_MARGIN = "800px 0px";
const RETENTION_ROOT_MARGIN = "3000px 0px";

/** A controllable IntersectionObserver so tests can drive which pages the viewer thinks are on screen. */
function mockIntersectionObserver(): IntersectionControl {
    interface Registration {
        callback: IntersectionObserverCallback;
        elements: Set<Element>;
        rootMargin: string;
    }

    const registrations: Registration[] = [];

    vi.stubGlobal(
        "IntersectionObserver",
        vi.fn(function (callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
            const registration: Registration = {
                callback,
                elements: new Set(),
                rootMargin: options?.rootMargin ?? "",
            };
            registrations.push(registration);

            return {
                observe: (element: Element) => registration.elements.add(element),
                unobserve: (element: Element) => registration.elements.delete(element),
                disconnect: () => {
                    registration.elements.clear();
                    registrations.splice(registrations.indexOf(registration), 1);
                },
            };
        }) as unknown as typeof IntersectionObserver,
    );

    const trigger = (rootMargin: string, element: Element, isIntersecting: boolean): void => {
        const matches = registrations.filter(
            (registration) => registration.rootMargin === rootMargin && registration.elements.has(element),
        );

        for (const registration of matches) {
            registration.callback(
                [{ isIntersecting, target: element } as IntersectionObserverEntry],
                {} as IntersectionObserver,
            );
        }
    };

    return {
        setNear: (element, isIntersecting) => trigger(RENDER_ROOT_MARGIN, element, isIntersecting),
        setRetained: (element, isIntersecting) => trigger(RETENTION_ROOT_MARGIN, element, isIntersecting),
    };
}

function mockElementRect(element: Element, rect: Partial<DOMRect>): void {
    element.getBoundingClientRect = vi.fn(
        () =>
            ({
                bottom: 0,
                height: 0,
                left: 0,
                right: 0,
                top: 0,
                width: 0,
                x: 0,
                y: 0,
                toJSON: vi.fn(),
                ...rect,
            }) as DOMRect,
    );
}

function createPage(): PDFPageProxy & { renderTask: RenderTask } {
    const renderTask = createRenderTask();

    return {
        cleanup: vi.fn(),
        getViewport: vi.fn(({ scale }: { scale: number }) => ({
            width: 612 * scale,
            height: 792 * scale,
            rawDims: {
                pageHeight: 792,
                pageWidth: 612,
                pageX: 0,
                pageY: 0,
            },
            rotation: 0,
            scale,
        })),
        render: vi.fn(() => renderTask),
        renderTask,
        streamTextContent: vi.fn(() => new ReadableStream()),
    } as unknown as PDFPageProxy & { renderTask: RenderTask };
}

function mockDocument(pageCount: number): {
    loadingTask: PDFDocumentLoadingTask;
    pages: Array<PDFPageProxy & { renderTask: RenderTask }>;
    pdfDocument: PDFDocumentProxy;
} {
    const pages = Array.from({ length: pageCount }, () => createPage());
    const loadingTask = {
        destroy: vi.fn(async () => {}),
    } as unknown as PDFDocumentLoadingTask;
    const pdfDocument = {
        getPage: vi.fn(async (pageNumber: number) => pages[pageNumber - 1]),
        loadingTask,
        numPages: pageCount,
    } as unknown as PDFDocumentProxy;

    Object.defineProperty(loadingTask, "promise", { value: Promise.resolve(pdfDocument) });
    pdfjsMock.getDocument.mockReturnValue(loadingTask);

    return { loadingTask, pages, pdfDocument };
}

describe("PdfViewer", () => {
    beforeEach(() => {
        pdfjsMock.getDocument.mockReset();
        pdfjsMock.GlobalWorkerOptions.workerSrc = undefined;
        pdfjsMock.MockTextLayer.cleanup.mockClear();
        vi.stubGlobal("IntersectionObserver", undefined);
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
        Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("loads a PDF and renders a selectable text layer for every page", async () => {
        const { pages } = mockDocument(3);

        render(<PdfViewer media={media()} />);

        expect(screen.getByRole("status")).toHaveTextContent("Loading PDF");
        expect(await screen.findAllByTestId("pdf-page")).toHaveLength(3);

        await waitFor(() => {
            expect(pages[0].render).toHaveBeenCalled();
            expect(pages[1].render).toHaveBeenCalled();
            expect(pages[2].render).toHaveBeenCalled();
        });
        expect(screen.getAllByText("Selectable PDF text")).toHaveLength(3);
        expect(pages[0].getViewport).toHaveBeenLastCalledWith({ scale: 96 / 72 });
    });

    it("renders the first page immediately before observed or prefetched pages", async () => {
        const observe = vi.fn();
        const disconnect = vi.fn();
        vi.stubGlobal(
            "IntersectionObserver",
            vi.fn(function () {
                return { disconnect, observe };
            }) as unknown as typeof IntersectionObserver,
        );
        vi.stubGlobal(
            "requestIdleCallback",
            vi.fn(() => 1),
        );
        const { pages } = mockDocument(3);

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalled());
        expect(pages[1].render).not.toHaveBeenCalled();
        expect(pages[2].render).not.toHaveBeenCalled();
    });

    it("uses fit-to-width as the default zoom even when it is below the standard minimum", async () => {
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
            return this.dataset.testid === "pdf-pages" ? 360 : 0;
        });
        const { pages } = mockDocument(1);
        const fitZoom = 360 / (612 * (96 / 72));

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(1));

        expect(getDisplayZoom()).toBeCloseTo(fitZoom);
        expect(pages[0].getViewport).toHaveBeenLastCalledWith({ scale: fitZoom * (96 / 72) });

        // Fit-to-width becomes the floor when it is below the standard minimum: zooming out cannot go under it.
        stubSynchronousAnimationFrame();
        act(() => fireZoomWheel(100));
        expect(getDisplayZoom()).toBeCloseTo(fitZoom);
    });

    it("clamps zoom to the configured bounds", async () => {
        const { pages } = mockDocument(1);

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(1));
        stubSynchronousAnimationFrame();

        act(() => {
            for (let i = 0; i < 20; i++) fireZoomWheel(-100);
        });

        expect(getDisplayZoom()).toBeCloseTo(PDF_VIEWER_MAX_ZOOM);
        await waitFor(() =>
            expect(pages[0].getViewport).toHaveBeenLastCalledWith({ scale: PDF_VIEWER_MAX_ZOOM * (96 / 72) }),
        );

        act(() => {
            for (let i = 0; i < 20; i++) fireZoomWheel(100);
        });

        expect(getDisplayZoom()).toBeCloseTo(PDF_VIEWER_MIN_ZOOM);
        await waitFor(() =>
            expect(pages[0].getViewport).toHaveBeenLastCalledWith({ scale: PDF_VIEWER_MIN_ZOOM * (96 / 72) }),
        );
    });

    it("zooms continuously with ctrl and mouse wheel, honouring the delta magnitude", async () => {
        const { pages } = mockDocument(1);

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(1));
        vi.useFakeTimers();

        const wheelZoom = async (deltaY: number): Promise<void> => {
            await act(async () => {
                fireZoomWheel(deltaY);
                // Wheel input is coalesced into an animation frame, so one gesture costs one layout pass.
                vi.advanceTimersByTime(16);
                await flushPromises();
            });
        };

        // A mouse notch (100px) lands close to a 25% step...
        await wheelZoom(-100);
        expect(getDisplayZoom()).toBeCloseTo(1.246, 3);
        expect(pages[0].render).toHaveBeenCalledTimes(1);

        // ...while zoom is multiplicative, so the same notch is the same proportion at any level.
        await wheelZoom(-100);
        expect(getDisplayZoom()).toBeCloseTo(1.553, 3);
        expect(pages[0].render).toHaveBeenCalledTimes(1);

        await act(async () => {
            vi.advanceTimersByTime(PDF_VIEWER_ZOOM_RENDER_DEBOUNCE_MS - 1);
            await flushPromises();
        });
        expect(pages[0].render).toHaveBeenCalledTimes(1);

        await act(async () => {
            vi.advanceTimersByTime(1);
            await flushPromises();
        });
        expect(pages[0].render).toHaveBeenCalledTimes(2);

        await wheelZoom(100);
        expect(getDisplayZoom()).toBeCloseTo(1.246, 3);
        expect(pages[0].render).toHaveBeenCalledTimes(2);

        await act(async () => {
            vi.advanceTimersByTime(PDF_VIEWER_ZOOM_RENDER_DEBOUNCE_MS);
            await flushPromises();
        });
        expect(pages[0].render).toHaveBeenCalledTimes(3);

        // A trackpad pinch arrives as a stream of small deltas and must not be quantised into a jump.
        await wheelZoom(-10);
        expect(getDisplayZoom()).toBeCloseTo(1.274, 3);
    });

    it("coalesces a burst of wheel events into a single zoom step", async () => {
        const { pages } = mockDocument(1);

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(1));
        vi.useFakeTimers();

        await act(async () => {
            for (let i = 0; i < 5; i++) fireZoomWheel(-10);
            vi.advanceTimersByTime(16);
            await flushPromises();
        });

        // Five deltas of 10 compose into one step, not five separate layout passes.
        expect(getDisplayZoom()).toBeCloseTo(Math.exp(50 * 0.0022), 3);
    });

    it("only re-rasterises pages near the viewport when the zoom changes", async () => {
        vi.stubGlobal(
            "requestIdleCallback",
            vi.fn(() => 1),
        );
        const intersection = mockIntersectionObserver();
        const { pages } = mockDocument(3);

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(1));
        stubSynchronousAnimationFrame();
        const pageElements = screen.getAllByTestId("pdf-page");

        act(() => intersection.setNear(pageElements[1], true));
        await waitFor(() => expect(pages[1].render).toHaveBeenCalledTimes(1));
        expect(pages[2].render).not.toHaveBeenCalled();

        act(() => fireZoomWheel(-100));

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(pages[1].render).toHaveBeenCalledTimes(2));
        expect(pages[2].render).not.toHaveBeenCalled();

        // Once page 2 scrolls away it keeps its existing raster instead of re-rendering on every step.
        act(() => intersection.setNear(pageElements[1], false));
        act(() => fireZoomWheel(-100));

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(3));
        expect(pages[1].render).toHaveBeenCalledTimes(2);

        // Scrolling back re-rasterises it at the zoom the user is now on.
        act(() => intersection.setNear(pageElements[1], true));
        await waitFor(() => expect(pages[1].render).toHaveBeenCalledTimes(3));
    });

    it("releases the canvases of pages scrolled far out of view without resizing them", async () => {
        const intersection = mockIntersectionObserver();
        const { pages } = mockDocument(1);
        const pageHeight = `${792 * (96 / 72)}px`;

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(1));
        const pageElement = screen.getByTestId("pdf-page");
        await waitFor(() =>
            expect([...pageElement.querySelectorAll("canvas")].some((canvas) => canvas.width > 0)).toBe(true),
        );
        expect(pageElement.style.getPropertyValue("--pdf-page-height")).toBe(pageHeight);

        act(() => intersection.setRetained(pageElement, false));

        expect([...pageElement.querySelectorAll("canvas")].every((canvas) => canvas.width === 0)).toBe(true);
        // The box keeps its size, so freeing the pixels never shifts the scroll height under the user.
        expect(pageElement.style.getPropertyValue("--pdf-page-height")).toBe(pageHeight);

        act(() => intersection.setRetained(pageElement, true));
        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(2));
    });

    it("keeps the visible position anchored when the zoom level changes", async () => {
        const { pages } = mockDocument(1);

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(1));
        stubSynchronousAnimationFrame();

        const pagesContainer = screen.getByTestId("pdf-pages");
        Object.defineProperties(pagesContainer, {
            clientHeight: { configurable: true, value: 500 },
            clientWidth: { configurable: true, value: 400 },
        });
        mockElementRect(pagesContainer, { height: 500, left: 0, top: 0, width: 400 });
        pagesContainer.scrollLeft = 20;
        pagesContainer.scrollTop = 400;

        act(() => fireZoomWheel(-100, { x: 200, y: 250 }));

        const zoomRatio = getDisplayZoom();
        expect(zoomRatio).toBeGreaterThan(1);
        expect(pagesContainer.scrollLeft).toBeCloseTo((20 + 200) * zoomRatio - 200);
        expect(pagesContainer.scrollTop).toBeCloseTo((400 + 250) * zoomRatio - 250);
    });

    it("zooms around the pointer rather than the centre", async () => {
        const { pages } = mockDocument(1);

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(1));
        stubSynchronousAnimationFrame();

        const pagesContainer = screen.getByTestId("pdf-pages");
        Object.defineProperties(pagesContainer, {
            clientHeight: { configurable: true, value: 500 },
            clientWidth: { configurable: true, value: 400 },
        });
        mockElementRect(pagesContainer, { height: 500, left: 0, top: 0, width: 400 });
        pagesContainer.scrollLeft = 0;
        pagesContainer.scrollTop = 0;

        // Pointer at the top-left corner: the content under it must not move.
        act(() => fireZoomWheel(-100, { x: 0, y: 0 }));

        expect(pagesContainer.scrollLeft).toBeCloseTo(0);
        expect(pagesContainer.scrollTop).toBeCloseTo(0);
    });

    it("restores the scroll position when the same PDF viewer is remounted", async () => {
        const selectedMedia = media();
        const first = mockDocument(1);
        const { unmount } = render(<PdfViewer media={selectedMedia} />);

        await waitFor(() => expect(first.pages[0].render).toHaveBeenCalledTimes(1));

        const firstPagesContainer = screen.getByTestId("pdf-pages");
        firstPagesContainer.scrollLeft = 30;
        firstPagesContainer.scrollTop = 420;
        fireEvent.scroll(firstPagesContainer);
        unmount();

        const second = mockDocument(1);
        render(<PdfViewer media={selectedMedia} />);

        await waitFor(() => expect(second.pages[0].render).toHaveBeenCalledTimes(1));

        const secondPagesContainer = screen.getByTestId("pdf-pages");
        expect(secondPagesContainer.scrollLeft).toBe(30);
        expect(secondPagesContainer.scrollTop).toBe(420);
    });

    it("keeps the committed page visible while rendering a new zoom level", async () => {
        const { pages } = mockDocument(1);
        const zoomRenderTask = createPendingRenderTask();
        (pages[0].render as Mock).mockReturnValueOnce(createRenderTask()).mockReturnValueOnce(zoomRenderTask);

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(1));
        stubSynchronousAnimationFrame();
        const page = screen.getByTestId("pdf-page");

        act(() => fireZoomWheel(-100));

        expect(getDisplayZoom()).toBeGreaterThan(1);
        expect(pages[0].render).toHaveBeenCalledTimes(1);
        expect(within(page).queryByRole("status")).not.toBeInTheDocument();
        expect([...page.querySelectorAll("canvas")].some((canvas) => canvas.width > 0 && canvas.height > 0)).toBe(true);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(2));
        expect(zoomRenderTask.cancel).not.toHaveBeenCalled();
    });

    it("destroys stale PDF.js resources when a different PDF is selected", async () => {
        const first = mockDocument(1);
        const firstMedia = media("first.pdf");
        const secondMedia = media("second.pdf");
        const { rerender } = render(<PdfViewer media={firstMedia} />);

        await waitFor(() => expect(first.pages[0].render).toHaveBeenCalled());

        const second = mockDocument(2);
        rerender(<PdfViewer media={secondMedia} />);

        await waitFor(() => expect(first.loadingTask.destroy).toHaveBeenCalled());
        await waitFor(() => expect(second.pages[1].render).toHaveBeenCalled());
        expect(screen.getAllByTestId("pdf-page")).toHaveLength(2);
    });

    it("cancels page rendering and text layers on unmount", async () => {
        const { loadingTask, pages } = mockDocument(1);
        const renderTask = createPendingRenderTask();
        (pages[0].render as Mock).mockReturnValueOnce(renderTask);
        const { unmount } = render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalled());
        unmount();

        await waitFor(() => expect(loadingTask.destroy).toHaveBeenCalled());
        expect(renderTask.cancel).toHaveBeenCalled();
        await waitFor(() => expect(pdfjsMock.MockTextLayer.cleanup).toHaveBeenCalled());
    });

    it("shows a clear error when the PDF cannot be loaded", async () => {
        const loadingTask = {
            destroy: vi.fn(async () => {}),
        } as unknown as PDFDocumentLoadingTask;
        Object.defineProperty(loadingTask, "promise", { value: Promise.reject(new Error("bad pdf")) });
        pdfjsMock.getDocument.mockReturnValue(loadingTask);

        render(<PdfViewer media={media("broken.pdf")} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load PDF.");
    });

    it("shows a page error when a page cannot be rendered", async () => {
        const { pages } = mockDocument(1);
        (pages[0].render as Mock).mockImplementationOnce(() => ({
            cancel: vi.fn(),
            promise: Promise.reject(new Error("render failed")),
        }));

        render(<PdfViewer media={media()} />);

        const page = await screen.findByTestId("pdf-page");
        expect(await within(page).findByRole("alert")).toHaveTextContent("Unable to render PDF.");
    });
});
