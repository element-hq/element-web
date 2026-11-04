/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import userEvent from "@testing-library/user-event";

import * as stories from "./MessageComposerUrlPreview.stories.tsx";
import {
    MessageComposerUrlPreviewView,
    type MessageComposerUrlPreviewSnapshot,
    type MessageComposerUrlPreviewSnapshotEntry,
} from "./MessageComposerUrlPreview";
import { MockViewModel } from "../../../core/viewmodel";

const { Default, MultipleLinks, LoadingAndFailed, WithRemoveButtons } = composeStories(stories);

function renderView(
    entries: MessageComposerUrlPreviewSnapshotEntry[],
    removePreview?: (url: string) => void,
): ReturnType<typeof render> {
    const snapshot: MessageComposerUrlPreviewSnapshot = {
        content: entries.map((entry) => entry.matched_url).join(" "),
        contentLinks: new Set(entries.map((entry) => entry.matched_url)),
        entries,
        isModified: false,
    };
    return render(<MessageComposerUrlPreviewView vm={new MockViewModel(snapshot)} removePreview={removePreview} />);
}

describe("MessageComposerUrlPreview", () => {
    it("renders a preview with an image", () => {
        const { container } = render(<Default />);
        expect(screen.getByText("1 link")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "UK economy rebounds as Covid restrictions ease" })).toHaveAttribute(
            "href",
            "https://www.bbc.co.uk/news/business-56559073",
        );
        // The host drops the www. prefix
        expect(screen.getByText("bbc.co.uk")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("renders a card per link, with the image, site logo or link icon", () => {
        const { container } = render(<MultipleLinks />);
        expect(screen.getByText("4 links")).toBeInTheDocument();
        expect(screen.getAllByRole("listitem")).toHaveLength(4);
        expect(container).toMatchSnapshot();
    });

    it("renders loading and failed entries", () => {
        const { container } = render(<LoadingAndFailed />);
        expect(screen.getByText("Fetching preview…")).toBeInTheDocument();
        expect(screen.getByText("Failed to fetch preview")).toBeInTheDocument();
        expect(screen.getByText("element.io")).toBeInTheDocument();
        expect(screen.getByText("example.com")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("has no remove or clear all buttons without removePreview", () => {
        render(<MultipleLinks />);
        expect(screen.queryByRole("button", { name: "Remove URL preview" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
    });

    it("removes every preview when clear all is clicked", async () => {
        const removePreview = vi.fn();
        render(<WithRemoveButtons removePreview={removePreview} />);

        await userEvent.click(screen.getByRole("button", { name: "Clear all" }));

        expect(removePreview).toHaveBeenCalledTimes(3);
        expect(removePreview).toHaveBeenCalledWith("https://www.bbc.co.uk/news/business-56559073");
        expect(removePreview).toHaveBeenCalledWith("https://github.com/element-hq/element-web/issues/12490");
        expect(removePreview).toHaveBeenCalledWith("https://nextcloud.com/s/frog");
    });

    it("removes the preview of the link whose remove button is clicked", async () => {
        const removePreview = vi.fn();
        render(<WithRemoveButtons removePreview={removePreview} />);

        const buttons = screen.getAllByRole("button", { name: "Remove URL preview" });
        expect(buttons).toHaveLength(3);
        await userEvent.click(buttons[1]);

        expect(removePreview).toHaveBeenCalledWith("https://github.com/element-hq/element-web/issues/12490");
    });

    it("hides entries that are not included", () => {
        renderView([
            { status: "loading", matched_url: "https://element.io", include: true },
            { status: "failed", matched_url: "https://example.com", include: false },
        ]);
        expect(screen.getByText("1 link")).toBeInTheDocument();
        expect(screen.queryByText("example.com")).not.toBeInTheDocument();
    });

    it("renders nothing when every entry is removed", () => {
        const { container } = renderView([{ status: "failed", matched_url: "https://example.com", include: false }]);
        expect(container).toBeEmptyDOMElement();
    });
});
