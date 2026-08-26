/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen } from "@test-utils";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ImageReplyBodyView, ImageReplyBodyViewPlaceholder } from "./ImageReplyBodyView";
import * as stories from "./ImageReplyBodyView.stories";

const { Default, WithBanner, LoadingWithSpinner, LoadingWithBlurhash, AnimatedPreview } = composeStories(stories);

describe("ImageReplyBodyView", () => {
    it.each([
        ["default", Default],
        ["with-banner", WithBanner],
        ["loading-with-spinner", LoadingWithSpinner],
        ["loading-with-blurhash", LoadingWithBlurhash],
        ["animated-preview", AnimatedPreview],
    ])("matches snapshot for %s story", (_name, Story) => {
        const { container } = render(<Story />);

        expect(container).toMatchSnapshot();
    });

    it("applies a custom className to the root element", () => {
        render(
            <ImageReplyBodyView
                className="custom-reply-body"
                src="https://example.org/image.png"
                alt="Reply preview"
                maxWidth={58}
                maxHeight={44}
                aspectRatio="4 / 3"
            />,
        );

        expect(screen.getByRole("img", { name: "Reply preview" }).closest(".custom-reply-body")).not.toBeNull();
    });

    it("renders a hidden measuring image when dimensions are not known yet", () => {
        const onImageLoad = vi.fn();

        const { container } = render(
            <ImageReplyBodyView src="https://example.org/image.png" alt="Reply preview" onImageLoad={onImageLoad} />,
        );

        const image = container.querySelector("img");
        expect(image).toHaveAttribute("alt", "Reply preview");
        expect(image).toHaveStyle({ display: "none" });

        fireEvent.load(image!);
        expect(onImageLoad).toHaveBeenCalledTimes(1);
    });

    it("renders an empty root when no image source is available", () => {
        const { container } = render(<ImageReplyBodyView className="empty-reply-body" />);

        expect(container.querySelector(".empty-reply-body")).not.toBeNull();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("does not render the measuring image when dimensions and visible media are unavailable", () => {
        const { container } = render(
            <ImageReplyBodyView src="https://example.org/image.png" alt="Reply preview" showImage={false} />,
        );

        expect(container.querySelector("img")).toBeNull();
    });

    it("swaps animated preview content and overlays on hover", () => {
        render(
            <ImageReplyBodyView
                src="https://example.org/full.gif"
                thumbnailSrc="https://example.org/thumb.png"
                alt="Animated reply preview"
                maxWidth={58}
                maxHeight={44}
                aspectRatio="4 / 3"
                showAnimatedContentOnHover
                gifLabel="GIF"
                bannerLabel="animated.gif"
            />,
        );

        const image = screen.getByRole("img", { name: "Animated reply preview" });
        expect(image).toHaveAttribute("src", "https://example.org/thumb.png");
        expect(screen.getByText("GIF")).toBeInTheDocument();
        expect(screen.queryByText("animated.gif")).not.toBeInTheDocument();

        fireEvent.mouseEnter(image);
        expect(image).toHaveAttribute("src", "https://example.org/full.gif");
        expect(screen.queryByText("GIF")).not.toBeInTheDocument();
        expect(screen.getByText("animated.gif")).toBeInTheDocument();

        fireEvent.mouseLeave(image);
        expect(image).toHaveAttribute("src", "https://example.org/thumb.png");
        expect(screen.getByText("GIF")).toBeInTheDocument();
        expect(screen.queryByText("animated.gif")).not.toBeInTheDocument();
    });

    it("invokes visible image load and error handlers", () => {
        const onImageLoad = vi.fn();
        const onImageError = vi.fn();

        render(
            <ImageReplyBodyView
                src="https://example.org/image.png"
                alt="Reply preview"
                maxWidth={58}
                maxHeight={44}
                aspectRatio="4 / 3"
                onImageLoad={onImageLoad}
                onImageError={onImageError}
            />,
        );

        const image = screen.getByRole("img", { name: "Reply preview" });
        fireEvent.load(image);
        fireEvent.error(image);

        expect(onImageLoad).toHaveBeenCalledTimes(1);
        expect(onImageError).toHaveBeenCalledTimes(1);
    });

    it("falls back to a spinner when the blurhash placeholder has no hash", () => {
        render(
            <ImageReplyBodyView
                src="https://example.org/image.png"
                alt="Reply preview"
                maxWidth={58}
                maxHeight={44}
                aspectRatio="4 / 3"
                placeholder={ImageReplyBodyViewPlaceholder.BLURHASH}
            />,
        );

        expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("uses explicit width sizing for SVG images", () => {
        render(
            <ImageReplyBodyView
                src="https://example.org/image.svg"
                alt="SVG reply preview"
                maxWidth={58}
                maxHeight={44}
                aspectRatio="4 / 3"
                isSvg
            />,
        );

        expect(screen.getByRole("img", { name: "SVG reply preview" }).parentElement).toHaveStyle({
            width: "58px",
            maxWidth: "58px",
            maxHeight: "44px",
        });
    });
});
