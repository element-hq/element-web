/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@test-utils";
import { describe, expect, it, vi } from "vitest";

import { PdfViewerView, type PdfViewerViewProps } from "./PdfViewerView";
import styles from "./PdfViewerView.module.css";
import { I18nApi } from "../../../core/i18n/I18nApi";
import { I18nContext } from "../../../core/i18n/i18nContext";

const defaultProps: PdfViewerViewProps = {
    status: "loading",
    currentPage: 1,
    pageCount: 0,
    pageInput: "1",
    containerRef: React.createRef<HTMLDivElement>(),
    viewerRef: React.createRef<HTMLDivElement>(),
    onPageInputChange: vi.fn(),
    onPageInputFocus: vi.fn(),
    onPageInputBlur: vi.fn(),
    onPageInputCancel: vi.fn(),
    onPageSubmit: vi.fn(),
};

const renderView = (props: Partial<PdfViewerViewProps> = {}): ReturnType<typeof render> =>
    render(<PdfViewerView {...defaultProps} {...props} />, {
        wrapper: ({ children }) => <I18nContext.Provider value={new I18nApi()}>{children}</I18nContext.Provider>,
    });

/** The page size pdf.js would write inline after fitting a page to the panel. */
const PAGE_WIDTH = 320;
const PAGE_HEIGHT = 453;

/**
 * Builds the layers pdf.js creates for a page into the element the host hands it, so the geometry the
 * stylesheet is responsible for can be measured the way a real page lays it out.
 */
function renderPdfJsPage(): {
    selection: HTMLElement;
    textLayer: HTMLElement;
    endOfContent: HTMLElement;
} {
    const viewerRef = React.createRef<HTMLDivElement>();
    renderView({ status: "ready", pageCount: 1, viewerRef });

    const page = document.createElement("div");
    page.className = "page";
    // pdf.js writes the fitted page geometry inline.
    page.style.width = `${PAGE_WIDTH}px`;
    page.style.height = `${PAGE_HEIGHT}px`;

    const canvasWrapper = document.createElement("div");
    canvasWrapper.className = "canvasWrapper";
    canvasWrapper.append(document.createElement("canvas"));

    // pdf.js clips this to the selected glyphs with an SVG path in `objectBoundingBox` units, measured
    // against the text layer. The SVG it puts inside is what the element collapses to if the stylesheet
    // does not size it.
    const selection = document.createElement("div");
    selection.className = "selection";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 1 1");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    selection.append(svg);
    canvasWrapper.append(selection);

    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";
    const endOfContent = document.createElement("div");
    endOfContent.className = "endOfContent";
    textLayer.append(endOfContent);

    page.append(canvasWrapper, textLayer);
    viewerRef.current!.append(page);

    return { selection, textLayer, endOfContent };
}

describe("PdfViewerView", () => {
    it("exposes the pdf.js container and viewer elements", () => {
        const containerRef = React.createRef<HTMLDivElement>();
        const viewerRef = React.createRef<HTMLDivElement>();

        renderView({ containerRef, viewerRef });

        expect(containerRef.current).toBe(screen.getByTestId("pdf-container"));
        expect(viewerRef.current).toHaveClass("pdfViewer");
    });

    it("uses locally scoped shell classes", () => {
        renderView({ status: "loading" });

        expect(screen.getByTestId("pdf-viewer")).toHaveClass(styles.viewer);
        expect(screen.getByTestId("pdf-container")).toHaveClass(styles.container);
        expect(screen.getByRole("status")).toHaveClass(styles.message);
    });

    it("adds a host class to the shell without replacing its own", () => {
        renderView({ className: "mx_HostViewer" });

        const viewer = screen.getByTestId("pdf-viewer");
        expect(viewer).toHaveClass("mx_HostViewer");
        expect(viewer).toHaveClass(styles.viewer);
    });

    it("announces that the PDF is loading", () => {
        renderView({ status: "loading" });

        expect(screen.getByRole("status")).toHaveTextContent("Loading PDF…");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("alerts when the PDF cannot be loaded", () => {
        renderView({ status: "error" });

        expect(screen.getByRole("alert")).toHaveTextContent("Unable to load PDF.");
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows the current page and page count when pages are available", () => {
        renderView({ status: "ready", currentPage: 5, pageCount: 42, pageInput: "5" });

        expect(screen.getByRole("group")).toHaveAccessibleName("Page 5 of 42");
        expect(screen.getByRole("textbox", { name: "Page number" })).toHaveValue("5");
        expect(screen.getByTestId("pdf-page-total")).toHaveTextContent("42");
    });

    it("forwards page input changes as values", async () => {
        const user = userEvent.setup();
        const onPageInputChange = vi.fn();
        renderView({ status: "ready", pageCount: 42, onPageInputChange });

        await user.type(screen.getByRole("textbox", { name: "Page number" }), "2");

        expect(onPageInputChange).toHaveBeenCalledWith("12");
    });

    it("forwards the page input editing lifecycle", async () => {
        const user = userEvent.setup();
        const onPageInputFocus = vi.fn();
        const onPageInputBlur = vi.fn();
        renderView({ status: "ready", pageCount: 42, onPageInputFocus, onPageInputBlur });
        const input = screen.getByRole("textbox", { name: "Page number" });

        await user.click(input);
        await user.tab();

        expect(onPageInputFocus).toHaveBeenCalledOnce();
        expect(onPageInputBlur).toHaveBeenCalledOnce();
    });

    it("forwards page submissions", async () => {
        const user = userEvent.setup();
        const onPageSubmit = vi.fn();
        renderView({ status: "ready", pageCount: 42, onPageSubmit });

        await user.click(screen.getByRole("textbox", { name: "Page number" }));
        await user.keyboard("{Enter}");

        expect(onPageSubmit).toHaveBeenCalledOnce();
    });

    it("forwards Escape as page input cancellation", async () => {
        const user = userEvent.setup();
        const onPageInputCancel = vi.fn();
        renderView({ status: "ready", pageCount: 42, onPageInputCancel });
        const input = screen.getByRole("textbox", { name: "Page number" });

        await user.click(input);
        await user.keyboard("{Enter}");
        expect(onPageInputCancel).not.toHaveBeenCalled();

        await user.keyboard("{Escape}");
        expect(onPageInputCancel).toHaveBeenCalledOnce();
    });

    describe("pdf.js page layers", () => {
        it("lays the selection layer over exactly the text layer's box", () => {
            const { selection, textLayer } = renderPdfJsPage();

            // pdf.js clips the selection in units of the text layer's box, so any difference here
            // displaces every highlight it draws.
            expect(selection.getBoundingClientRect().toJSON()).toEqual(textLayer.getBoundingClientRect().toJSON());
        });

        it("parks the end-of-content marker below the text until a selection is dragged", () => {
            const { textLayer, endOfContent } = renderPdfJsPage();

            expect(endOfContent.getBoundingClientRect().top).toBe(textLayer.getBoundingClientRect().bottom);

            // pdf.js marks the layer while a selection is being dragged, which grows the marker over the
            // page so that dragging past the end of a line keeps extending the selection.
            textLayer.classList.add("selecting");
            expect(endOfContent.getBoundingClientRect().top).toBe(textLayer.getBoundingClientRect().top);
        });
    });
});
