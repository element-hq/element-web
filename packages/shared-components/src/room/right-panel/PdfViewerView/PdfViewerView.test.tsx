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
});
