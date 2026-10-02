/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React from "react";
import { render, screen } from "@test-utils";
import { describe, expect, it } from "vitest";

import { DocumentViewerView, type DocumentViewerViewProps } from "./DocumentViewerView";
import styles from "./DocumentViewerView.module.css";
import { I18nApi } from "../../../core/i18n/I18nApi";
import { I18nContext } from "../../../core/i18n/i18nContext";

const renderView = (props: Partial<DocumentViewerViewProps> = {}): ReturnType<typeof render> =>
    render(
        <DocumentViewerView status="ready" {...props}>
            <div data-testid="surface">Surface</div>
        </DocumentViewerView>,
        {
            wrapper: ({ children }) => <I18nContext.Provider value={new I18nApi()}>{children}</I18nContext.Provider>,
        },
    );

describe("DocumentViewerView", () => {
    it("renders the document surface inside the shell", () => {
        renderView();

        expect(screen.getByTestId("document-viewer")).toHaveClass(styles.viewer);
        expect(screen.getByTestId("surface")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("adds a host class without replacing its own", () => {
        renderView({ className: "mx_HostViewer" });

        const viewer = screen.getByTestId("document-viewer");
        expect(viewer).toHaveClass("mx_HostViewer");
        expect(viewer).toHaveClass(styles.viewer);
    });

    it("shows the toolbar only when the viewer provides one", () => {
        const { rerender } = renderView();
        expect(screen.queryByText("Controls")).not.toBeInTheDocument();

        rerender(
            <I18nContext.Provider value={new I18nApi()}>
                <DocumentViewerView status="ready" toolbar={<span>Controls</span>} />
            </I18nContext.Provider>,
        );

        expect(screen.getByText("Controls").parentElement).toHaveClass(styles.toolbar);
    });

    it("announces that the document is loading, over the surface", () => {
        renderView({ status: "loading" });

        expect(screen.getByRole("status")).toHaveTextContent("Loading document…");
        expect(screen.getByRole("status")).toHaveClass(styles.message);
        // The surface stays mounted so a viewer can render into it while the overlay is up.
        expect(screen.getByTestId("surface")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("alerts when the document cannot be loaded", () => {
        renderView({ status: "error" });

        expect(screen.getByRole("alert")).toHaveTextContent("Unable to load this file.");
        expect(screen.getByRole("alert")).toHaveClass(styles.error);
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
});
