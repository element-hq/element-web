/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../../../core/viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import {
    ImageBodyView,
    ImageBodyViewPlaceholder,
    ImageBodyViewState,
    type ImageBodyViewActions,
    type ImageBodyViewSnapshot,
} from "./ImageBodyView";

const imageSrc = new URL("../../../../../../static/image-body/install-spinner.png", import.meta.url).href;
const thumbnailSrc = new URL("../../../../../../static/image-body/install-spinner.png", import.meta.url).href;
const animatedGifSrc = new URL("../../../../../../static/image-body/install-spinner.gif", import.meta.url).href;
const demoBlurhash = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

type ImageBodyViewProps = ImageBodyViewSnapshot &
    ImageBodyViewActions & {
        className?: string;
        children?: ReactNode;
    };

const ImageBodyViewWrapperImpl = ({
    onLinkClick,
    onHiddenButtonClick,
    onImageLoad,
    onImageError,
    className,
    children,
    ...snapshotProps
}: ImageBodyViewProps): ReactNode => {
    const vm = useMockedViewModel(snapshotProps, {
        onLinkClick: onLinkClick ?? fn(),
        onHiddenButtonClick: onHiddenButtonClick ?? fn(),
        onImageLoad: onImageLoad ?? fn(),
        onImageError: onImageError ?? fn(),
    });

    return (
        <ImageBodyView vm={vm} className={className}>
            {children}
        </ImageBodyView>
    );
};

const ImageBodyViewWrapper = withViewDocs(ImageBodyViewWrapperImpl, ImageBodyView);

const meta = {
    title: "MessageBody/ImageBodyView",
    component: ImageBodyViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        state: {
            options: Object.entries(ImageBodyViewState)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
        placeholder: {
            options: Object.entries(ImageBodyViewPlaceholder)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
        className: { control: "text" },
    },
    args: {
        state: ImageBodyViewState.READY,
        alt: "Element logo",
        hiddenButtonLabel: "Show image",
        errorLabel: "Error loading image",
        src: imageSrc,
        thumbnailSrc,
        showAnimatedContentOnHover: false,
        placeholder: ImageBodyViewPlaceholder.NONE,
        blurhash: demoBlurhash,
        maxWidth: 320,
        maxHeight: 240,
        aspectRatio: "4 / 3",
        isSvg: false,
        gifLabel: undefined,
        bannerLabel: "install-spinner.png",
        tooltipLabel: undefined,
        linkUrl: imageSrc,
        linkTarget: undefined,
        className: undefined,
        children: <div>File body slot</div>,
    },
} satisfies Meta<typeof ImageBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Hidden: Story = {
    args: {
        state: ImageBodyViewState.HIDDEN,
        linkUrl: undefined,
        tooltipLabel: undefined,
    },
};

export const LoadingWithSpinner: Story = {
    args: {
        placeholder: ImageBodyViewPlaceholder.SPINNER,
    },
};

export const LoadingWithBlurhash: Story = {
    args: {
        placeholder: ImageBodyViewPlaceholder.BLURHASH,
    },
};

export const AnimatedPreview: Story = {
    args: {
        src: animatedGifSrc,
        thumbnailSrc,
        linkUrl: animatedGifSrc,
        showAnimatedContentOnHover: true,
        gifLabel: "GIF",
    },
};

export const ErrorState: Story = {
    args: {
        state: ImageBodyViewState.ERROR,
        linkUrl: undefined,
        children: undefined,
    },
};

export const WithTooltip: Story = {
    args: {
        tooltipLabel: "Tooltip image name",
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.hover(canvas.getByRole("img", { name: "Element logo" }));
        await expect(
            within(canvasElement.ownerDocument.body).findByText("Tooltip image name"),
        ).resolves.toBeInTheDocument();
    },
};
