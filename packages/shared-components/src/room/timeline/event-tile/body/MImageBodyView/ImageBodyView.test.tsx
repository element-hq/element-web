/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../../../../core/viewmodel/MockViewModel";
import * as stories from "./ImageBodyView.stories";
import {
    ImageBodyView,
    ImageBodyViewPlaceholder,
    ImageBodyViewState,
    type ImageBodyViewActions,
    type ImageBodyViewSnapshot,
} from "./ImageBodyView";

const { Default, Hidden, LoadingWithSpinner, LoadingWithBlurhash, AnimatedPreview, ErrorState } =
    composeStories(stories);

class TestImageBodyViewModel extends MockViewModel<ImageBodyViewSnapshot> implements ImageBodyViewActions {
    public onLinkClick?: ImageBodyViewActions["onLinkClick"];
    public onHiddenButtonClick?: ImageBodyViewActions["onHiddenButtonClick"];
    public onImageLoad?: ImageBodyViewActions["onImageLoad"];
    public onImageError?: ImageBodyViewActions["onImageError"];

    public constructor(snapshot: ImageBodyViewSnapshot, actions: ImageBodyViewActions = {}) {
        super(snapshot);
        this.onLinkClick = actions.onLinkClick;
        this.onHiddenButtonClick = actions.onHiddenButtonClick;
        this.onImageLoad = actions.onImageLoad;
        this.onImageError = actions.onImageError;
    }
}

describe("ImageBodyView", () => {
    it.each([
        ["default", Default],
        ["hidden", Hidden],
        ["loading-with-spinner", LoadingWithSpinner],
        ["loading-with-blurhash", LoadingWithBlurhash],
        ["animated-preview", AnimatedPreview],
        ["error", ErrorState],
    ])("matches snapshot for %s story", (_name, Story) => {
        const { container } = render(<Story />);
        expect(container).toMatchSnapshot();
    });

    it("renders the hidden preview button and invokes the click handler", async () => {
        const user = userEvent.setup();
        const onHiddenButtonClick = vi.fn();
        const vm = new TestImageBodyViewModel(
            {
                state: ImageBodyViewState.HIDDEN,
                hiddenButtonLabel: "Show image",
                maxWidth: 320,
                maxHeight: 240,
                aspectRatio: "4 / 3",
            },
            { onHiddenButtonClick },
        );

        render(<ImageBodyView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Show image" }));
        expect(onHiddenButtonClick).toHaveBeenCalledTimes(1);
    });

    it("renders an error label when the media cannot be displayed", () => {
        const vm = new TestImageBodyViewModel({
            state: ImageBodyViewState.ERROR,
            errorLabel: "Error decrypting image",
        });

        render(<ImageBodyView vm={vm} />);

        expect(screen.getByText("Error decrypting image")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("renders a link wrapper and forwards the click handler", () => {
        const onLinkClick = vi.fn();
        const vm = new TestImageBodyViewModel(
            {
                state: ImageBodyViewState.READY,
                alt: "Linked image",
                src: "https://example.org/full.png",
                thumbnailSrc: "https://example.org/thumb.png",
                linkUrl: "https://example.org/full.png",
                linkTarget: "_blank",
                maxWidth: 320,
                maxHeight: 240,
                aspectRatio: "4 / 3",
            },
            { onLinkClick },
        );

        render(<ImageBodyView vm={vm} />);

        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "https://example.org/full.png");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noreferrer noopener");

        fireEvent.click(link);
        expect(onLinkClick).toHaveBeenCalledTimes(1);
    });

    it("swaps to the full source on hover for animated previews", async () => {
        const user = userEvent.setup();
        const vm = new TestImageBodyViewModel({
            state: ImageBodyViewState.READY,
            alt: "Animated image",
            src: "https://example.org/full.gif",
            thumbnailSrc: "https://example.org/thumb.png",
            showAnimatedContentOnHover: true,
            gifLabel: "GIF",
            maxWidth: 320,
            maxHeight: 240,
            aspectRatio: "4 / 3",
        });

        render(<ImageBodyView vm={vm} />);

        const image = screen.getByRole("img", { name: "Animated image" }) as HTMLImageElement;
        expect(image).toHaveAttribute("src", "https://example.org/thumb.png");
        expect(screen.getByText("GIF")).toBeInTheDocument();

        await user.hover(image);
        expect(image).toHaveAttribute("src", "https://example.org/full.gif");
        expect(screen.queryByText("GIF")).not.toBeInTheDocument();
    });

    it("renders the configured placeholder state", () => {
        const vm = new TestImageBodyViewModel({
            state: ImageBodyViewState.READY,
            alt: "Loading image",
            src: "https://example.org/full.png",
            placeholder: ImageBodyViewPlaceholder.SPINNER,
            maxWidth: 320,
            maxHeight: 240,
            aspectRatio: "4 / 3",
        });

        render(<ImageBodyView vm={vm} />);

        expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("invokes image load and error handlers", () => {
        const onImageLoad = vi.fn();
        const onImageError = vi.fn();
        const vm = new TestImageBodyViewModel(
            {
                state: ImageBodyViewState.READY,
                alt: "Loaded image",
                src: "https://example.org/full.png",
                thumbnailSrc: "https://example.org/thumb.png",
                maxWidth: 320,
                maxHeight: 240,
                aspectRatio: "4 / 3",
            },
            { onImageLoad, onImageError },
        );

        render(<ImageBodyView vm={vm} />);

        const image = screen.getByRole("img", { name: "Loaded image" });
        fireEvent.load(image);
        fireEvent.error(image);

        expect(onImageLoad).toHaveBeenCalledTimes(1);
        expect(onImageError).toHaveBeenCalledTimes(1);
    });
});
