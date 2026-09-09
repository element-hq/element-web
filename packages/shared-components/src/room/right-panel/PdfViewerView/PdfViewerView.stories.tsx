/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, useRef } from "react";
import { expect, fn, waitFor } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { PdfViewerView, type PdfViewerViewProps } from "./PdfViewerView";
import samplePage from "../../../../static/pdf-viewer/sample-page.png";

type PdfViewerStoryProps = Omit<PdfViewerViewProps, "containerRef" | "viewerRef">;

/**
 * Adapts Storybook controls to the shell's ref-based host API.
 *
 * The ready state installs a rasterized page from the app-owned PDF fixture into the same mount point
 * that the app gives to pdf.js. This keeps the example realistic without moving the renderer here.
 */
function PdfViewerStory({ status, ...props }: PdfViewerStoryProps): JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        viewer.replaceChildren();
        if (status !== "ready") return;

        const page = document.createElement("div");
        page.className = "page";
        page.dataset.pageNumber = "1";
        // pdf.js also writes the rendered page geometry inline after fitting it to the container.
        page.style.width = "320px";
        page.style.height = "453px";

        const preview = document.createElement("img");
        preview.alt = "";
        preview.dataset.testid = "pdf-story-page";
        preview.src = samplePage;
        preview.style.display = "block";
        preview.style.width = "100%";
        preview.style.height = "100%";

        page.append(preview);
        viewer.append(page);
    }, [status]);

    return (
        <div style={{ width: 420, height: 560 }}>
            <PdfViewerView {...props} status={status} containerRef={containerRef} viewerRef={viewerRef} />
        </div>
    );
}

const meta = {
    title: "Room/Right Panel/PdfViewerView",
    component: PdfViewerStory,
    tags: ["autodocs"],
    parameters: {
        layout: "centered",
    },
    argTypes: {
        status: {
            options: ["loading", "ready", "error"],
            control: { type: "select" },
        },
    },
    args: {
        status: "loading",
        currentPage: 1,
        pageCount: 0,
        pageInput: "1",
        onPageInputChange: fn(),
        onPageInputFocus: fn(),
        onPageInputBlur: fn(),
        onPageInputCancel: fn(),
        onPageSubmit: fn(),
    },
} satisfies Meta<typeof PdfViewerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};

export const Ready: Story = {
    args: {
        status: "ready",
        currentPage: 1,
        pageCount: 5,
        pageInput: "1",
    },
    play: async ({ canvasElement }) => {
        await waitFor(() => {
            const preview = canvasElement.querySelector<HTMLImageElement>("[data-testid='pdf-story-page']");

            expect(preview).toHaveAttribute("src", samplePage);
            expect(preview?.complete).toBe(true);
            expect(preview?.naturalWidth).toBeGreaterThan(0);
        });
    },
};

export const ErrorState: Story = {
    args: {
        status: "error",
    },
};
