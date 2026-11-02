/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@test-utils";
import { describe, expect, it, vi } from "vitest";

import { MarkdownViewerView, type MarkdownViewerViewProps } from "./MarkdownViewerView";
import styles from "./MarkdownViewerView.module.css";
import shellStyles from "../DocumentViewerView/DocumentViewerView.module.css";
import { I18nApi } from "../../../core/i18n/I18nApi";
import { I18nContext } from "../../../core/i18n/i18nContext";

const defaultProps: MarkdownViewerViewProps = {
    status: "loading",
    html: "",
};

const renderView = (props: Partial<MarkdownViewerViewProps> = {}): ReturnType<typeof render> =>
    render(<MarkdownViewerView {...defaultProps} {...props} />, {
        wrapper: ({ children }) => <I18nContext.Provider value={new I18nApi()}>{children}</I18nContext.Provider>,
    });

describe("MarkdownViewerView", () => {
    it("builds on the shared document viewer shell", () => {
        renderView({ status: "ready", html: "<p>Hi</p>" });

        expect(screen.getByTestId("document-viewer")).toHaveClass(shellStyles.viewer);
        expect(screen.getByTestId("markdown-content")).toHaveClass(styles.content);
    });

    it("adds a host class to the shell without replacing its own", () => {
        renderView({ className: "mx_HostViewer" });

        const viewer = screen.getByTestId("document-viewer");
        expect(viewer).toHaveClass("mx_HostViewer");
        expect(viewer).toHaveClass(shellStyles.viewer);
    });

    it("shows the loading state without any document", () => {
        renderView({ status: "loading" });

        expect(screen.getByRole("status")).toHaveTextContent("Loading document…");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByTestId("markdown-content")).not.toBeInTheDocument();
    });

    it("shows the error state without any document", () => {
        renderView({ status: "error", html: "<p>stale</p>" });

        expect(screen.getByRole("alert")).toHaveTextContent("Unable to load this file.");
        expect(screen.queryByTestId("markdown-content")).not.toBeInTheDocument();
    });

    it("shows the rendered document once it is ready", () => {
        renderView({ status: "ready", html: "<h1>Title</h1><p>Body</p>" });

        expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
        expect(screen.getByText("Body")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("forwards clicks within the document to the host", async () => {
        const user = userEvent.setup();
        const onContentClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
        renderView({ status: "ready", html: '<p><a href="https://example.org/">A link</a></p>', onContentClick });

        await user.click(screen.getByRole("link", { name: "A link" }));

        expect(onContentClick).toHaveBeenCalledOnce();
    });
});
