/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen, within } from "@test-utils";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../../../../core/viewmodel/MockViewModel";
import {
    GALLERY_BODY_MAX_TILES,
    GalleryBodyView,
    GalleryBodyViewItemState,
    GalleryBodyViewState,
    type GalleryBodyViewActions,
    type GalleryBodyViewItem,
    type GalleryBodyViewModel,
    type GalleryBodyViewSnapshot,
} from "./GalleryBodyView";
import * as stories from "./GalleryBodyView.stories";

const { Default, ThreeItems, MoreItemsThanTiles, WithVideo, LoadingAndError, Hidden } = composeStories(stories);

function makeItems(count: number): GalleryBodyViewItem[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `item-${index}`,
        type: "image",
        state: GalleryBodyViewItemState.READY,
        label: `Image ${index + 1}`,
        src: `https://example.org/${index}.png`,
    }));
}

function makeViewModel(
    snapshot: Partial<GalleryBodyViewSnapshot> = {},
    actions: Partial<GalleryBodyViewActions> = {},
): GalleryBodyViewModel {
    const vm = new MockViewModel<GalleryBodyViewSnapshot>({
        state: GalleryBodyViewState.READY,
        label: "Gallery",
        items: makeItems(2),
        moreCount: 0,
        hiddenButtonLabel: "Show gallery",
        ...snapshot,
    }) as unknown as GalleryBodyViewModel;
    Object.assign(vm, {
        onItemClick: vi.fn(),
        onItemError: vi.fn(),
        onHiddenButtonClick: vi.fn(),
        ...actions,
    });
    return vm;
}

describe("GalleryBodyView", () => {
    it("renders the default story", () => {
        const { container } = render(<Default />);

        expect(container).toMatchSnapshot();
        const gallery = screen.getByRole("group", { name: "Gallery with 4 items" });
        expect(within(gallery).getAllByRole("button")).toHaveLength(4);
        expect(gallery).toHaveAttribute("data-layout", "4");
    });

    it("lays out three tiles", () => {
        const { container } = render(<ThreeItems />);

        expect(container).toMatchSnapshot();
        expect(screen.getByRole("group")).toHaveAttribute("data-layout", "3");
    });

    it("shows how many items have no tile on the last tile", () => {
        render(<MoreItemsThanTiles />);

        const tiles = screen.getAllByRole("button");
        expect(tiles).toHaveLength(5);
        expect(within(tiles[4]).getByText("+7")).toBeInTheDocument();
        expect(within(tiles[3]).queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it("never renders more tiles than the grid can lay out", () => {
        render(<GalleryBodyView vm={makeViewModel({ items: makeItems(GALLERY_BODY_MAX_TILES + 3) })} />);

        expect(screen.getAllByRole("button")).toHaveLength(GALLERY_BODY_MAX_TILES);
        expect(screen.getByRole("group")).toHaveAttribute("data-layout", String(GALLERY_BODY_MAX_TILES));
    });

    it("marks videos with their duration", () => {
        const { container } = render(<WithVideo />);

        expect(container).toMatchSnapshot();
        expect(within(screen.getByRole("button", { name: "Video 2 of 2" })).getByText("0:42")).toBeInTheDocument();
    });

    it("renders loading and failed tiles without a thumbnail", () => {
        const { container } = render(<LoadingAndError />);

        expect(container).toMatchSnapshot();
        expect(screen.getByRole("button", { name: "Image 2 of 3" }).querySelector("img")).toBeNull();
        expect(
            screen
                .getByRole("button", { name: "Image 3 of 3, unable to show image due to error" })
                .querySelector("img"),
        ).toBeNull();
    });

    it("renders nothing for a gallery without items", () => {
        const { container } = render(<GalleryBodyView vm={makeViewModel({ items: [] })} />);

        expect(container).toBeEmptyDOMElement();
    });

    it("applies a custom className to the grid", () => {
        render(<GalleryBodyView vm={makeViewModel()} className="custom-gallery" />);

        expect(screen.getByRole("group")).toHaveClass("custom-gallery");
    });

    it("reports which tile was clicked", async () => {
        const user = userEvent.setup();
        const onItemClick = vi.fn();
        render(<GalleryBodyView vm={makeViewModel({}, { onItemClick })} />);

        await user.click(screen.getByRole("button", { name: "Image 2" }));

        expect(onItemClick).toHaveBeenCalledTimes(1);
        expect(onItemClick).toHaveBeenCalledWith("item-1", expect.anything());
    });

    it("reports a thumbnail which fails to display", () => {
        const onItemError = vi.fn();
        render(<GalleryBodyView vm={makeViewModel({}, { onItemError })} />);

        fireEvent.error(screen.getByRole("button", { name: "Image 1" }).querySelector("img")!);

        expect(onItemError).toHaveBeenCalledWith("item-0");
    });

    it("hides the tiles until the user chooses to show them", async () => {
        const user = userEvent.setup();
        const onHiddenButtonClick = vi.fn();
        const { container } = render(<Hidden />);

        expect(container).toMatchSnapshot();
        expect(screen.queryByRole("group")).not.toBeInTheDocument();
        expect(container.querySelector("img")).toBeNull();

        render(<GalleryBodyView vm={makeViewModel({ state: GalleryBodyViewState.HIDDEN }, { onHiddenButtonClick })} />);
        await user.click(screen.getAllByRole("button", { name: "Show gallery" })[1]);

        expect(onHiddenButtonClick).toHaveBeenCalledTimes(1);
    });
});
