/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { expect, fn, waitFor } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { PdfViewerView, type PdfViewerViewProps } from "./PdfViewerView";
import samplePage from "../../../../static/pdf-viewer/sample-page.png";

/** Adapts Storybook controls to the shell's API. The ready state shows a rasterized page as the surface. */
function PdfViewerStory({ status, ...props }: PdfViewerViewProps): JSX.Element {
    return (
        <div style={{ width: 420, height: 560 }}>
            <PdfViewerView {...props} status={status}>
                {status === "ready" ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
                        <img
                            alt=""
                            data-testid="pdf-story-page"
                            src={samplePage}
                            style={{
                                display: "block",
                                width: 320,
                                height: 453,
                                background: "white",
                                boxShadow: "0 2px 8px rgb(0 0 0 / 0.18)",
                            }}
                        />
                    </div>
                ) : null}
            </PdfViewerView>
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
        onZoomIn: fn(),
        onZoomOut: fn(),
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
