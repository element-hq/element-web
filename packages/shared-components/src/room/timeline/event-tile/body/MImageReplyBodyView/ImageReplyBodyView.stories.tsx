/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";
import { expect, userEvent, within } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { ImageReplyBodyView, ImageReplyBodyViewPlaceholder, type ImageReplyBodyViewProps } from "./ImageReplyBodyView";
import imageSrc from "../../../../../../static/image-body/install-spinner.png";

const demoBlurhash = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

type ImageReplyBodyViewWrapperProps = Omit<ImageReplyBodyViewProps, "aspectRatio"> & {
    aspectRatio?: string;
};

const ImageReplyBodyViewWrapperImpl = (props: ImageReplyBodyViewWrapperProps): ReactNode => (
    <ImageReplyBodyView {...props} />
);

const ImageReplyBodyViewWrapper = withViewDocs(ImageReplyBodyViewWrapperImpl, ImageReplyBodyView);

const meta = {
    title: "Timeline/Timeline Body/ImageReplyBodyView",
    component: ImageReplyBodyViewWrapper,
    tags: ["autodocs"],
    args: {
        className: "",
        src: imageSrc,
        thumbnailSrc: imageSrc,
        alt: "Reply preview",
        maxWidth: 57,
        maxHeight: 44,
        aspectRatio: "57 / 43.95",
        placeholder: ImageReplyBodyViewPlaceholder.NONE,
        blurhash: demoBlurhash,
    },
    decorators: [
        (Story) => (
            <div style={{ maxWidth: 220 }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof ImageReplyBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBanner: Story = {
    args: {
        bannerLabel: "image.png",
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.hover(canvas.getByRole("img", { name: "Reply preview" }));
        await expect(canvas.findByText("image.png")).resolves.toBeInTheDocument();
    },
};

export const LoadingWithSpinner: Story = {
    args: {
        placeholder: ImageReplyBodyViewPlaceholder.SPINNER,
    },
};

export const LoadingWithBlurhash: Story = {
    args: {
        placeholder: ImageReplyBodyViewPlaceholder.BLURHASH,
    },
    // The blurhash <canvas> rasterizes to one of two ~33px-apart variants per run;
    // tolerate that benign jitter rather than flake against the strict 3px default.
    parameters: {
        snapshot: {
            failureThreshold: 100,
        },
    },
};

export const AnimatedPreview: Story = {
    args: {
        showAnimatedContentOnHover: true,
        gifLabel: "GIF",
    },
};
