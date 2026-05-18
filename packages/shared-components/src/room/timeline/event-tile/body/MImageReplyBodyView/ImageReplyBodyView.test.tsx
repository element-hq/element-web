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

import { ImageReplyBodyView } from "./ImageReplyBodyView";
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
});
