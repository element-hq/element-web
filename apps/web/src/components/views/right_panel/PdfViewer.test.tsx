/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor, within } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import type { UploadedMedia } from "@element-hq/element-web-module-api";

import { PDF_VIEWER_MAX_ZOOM, PDF_VIEWER_MIN_ZOOM, PdfViewer } from "./PdfViewer";

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
        expect(screen.getByTestId("pdf-zoom-value")).toHaveTextContent("100%");
    });

    it("zooms in and out without exceeding the configured bounds", async () => {
        const user = userEvent.setup();
        const { pages } = mockDocument(1);

        render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(1));

        await user.click(screen.getByRole("button", { name: "Zoom in" }));

        expect(screen.getByTestId("pdf-zoom-value")).toHaveTextContent("125%");
        await waitFor(() => expect(pages[0].render).toHaveBeenCalledTimes(2));
        expect(pages[0].getViewport).toHaveBeenLastCalledWith({ scale: 1.25 * (96 / 72) });

        const zoomOut = screen.getByRole("button", { name: "Zoom out" });
        for (let i = 0; i < 20; i++) {
            await user.click(zoomOut);
        }

        expect(screen.getByTestId("pdf-zoom-value")).toHaveTextContent(`${PDF_VIEWER_MIN_ZOOM * 100}%`);
        expect(zoomOut).toHaveAttribute("aria-disabled", "true");

        const zoomIn = screen.getByRole("button", { name: "Zoom in" });
        for (let i = 0; i < 20; i++) {
            await user.click(zoomIn);
        }

        expect(screen.getByTestId("pdf-zoom-value")).toHaveTextContent(`${PDF_VIEWER_MAX_ZOOM * 100}%`);
        expect(zoomIn).toHaveAttribute("aria-disabled", "true");
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
        const { unmount } = render(<PdfViewer media={media()} />);

        await waitFor(() => expect(pages[0].render).toHaveBeenCalled());
        unmount();

        await waitFor(() => expect(loadingTask.destroy).toHaveBeenCalled());
        expect(pages[0].renderTask.cancel).toHaveBeenCalled();
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
