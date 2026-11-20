/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import squareImage from "../../../../../../static/element.png";
import tallImage from "../../../../../../static/tallImage.png";
import wideImage from "../../../../../../static/wideImage.png";
import { useMockedViewModel } from "../../../../../core/viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import {
    GalleryBodyView,
    GalleryBodyViewItemState,
    GalleryBodyViewState,
    type GalleryBodyViewActions,
    type GalleryBodyViewItem,
    type GalleryBodyViewSnapshot,
} from "./GalleryBodyView";

type GalleryBodyViewProps = GalleryBodyViewSnapshot & GalleryBodyViewActions & { className?: string };

const GalleryBodyViewWrapperImpl = ({
    onItemClick,
    onItemError,
    onHiddenButtonClick,
    className,
    ...snapshotProps
}: GalleryBodyViewProps): ReactNode => {
    const vm = useMockedViewModel(snapshotProps, { onItemClick, onItemError, onHiddenButtonClick });

    return <GalleryBodyView vm={vm} className={className} />;
};

const GalleryBodyViewWrapper = withViewDocs(GalleryBodyViewWrapperImpl, GalleryBodyView);

const images = [wideImage, tallImage, squareImage];

function makeItems(count: number): GalleryBodyViewItem[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `item-${index}`,
        type: "image",
        state: GalleryBodyViewItemState.READY,
        label: `Image ${index + 1} of ${count}`,
        src: images[index % images.length],
    }));
}

const meta = {
    title: "Timeline/Timeline Body/GalleryBodyView",
    component: GalleryBodyViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        state: {
            options: [GalleryBodyViewState.READY, GalleryBodyViewState.HIDDEN],
            control: { type: "select" },
        },
        className: { control: "text" },
    },
    args: {
        state: GalleryBodyViewState.READY,
        label: "Gallery with 4 items",
        items: makeItems(4),
        moreCount: 0,
        hiddenButtonLabel: "Show gallery",
        onItemClick: fn(),
        onItemError: fn(),
        onHiddenButtonClick: fn(),
        className: "",
    },
} satisfies Meta<typeof GalleryBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OneItem: Story = {
    args: { label: "Gallery with 1 item", items: makeItems(1) },
};

export const TwoItems: Story = {
    args: { label: "Gallery with 2 items", items: makeItems(2) },
};

export const ThreeItems: Story = {
    args: { label: "Gallery with 3 items", items: makeItems(3) },
};

export const FiveItems: Story = {
    args: { label: "Gallery with 5 items", items: makeItems(5) },
};

export const MoreItemsThanTiles: Story = {
    args: { label: "Gallery with 12 items", items: makeItems(5), moreCount: 7 },
};

export const WithVideo: Story = {
    args: {
        label: "Gallery with 2 items",
        items: [
            makeItems(2)[0],
            {
                id: "video",
                type: "video",
                state: GalleryBodyViewItemState.READY,
                label: "Video 2 of 2",
                src: wideImage,
                durationLabel: "0:42",
            },
        ],
    },
};

export const LoadingAndError: Story = {
    args: {
        label: "Gallery with 3 items",
        items: [
            makeItems(3)[0],
            {
                id: "loading",
                type: "image",
                state: GalleryBodyViewItemState.LOADING,
                label: "Image 2 of 3",
                blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
            },
            {
                id: "error",
                type: "image",
                state: GalleryBodyViewItemState.ERROR,
                label: "Image 3 of 3, unable to show image due to error",
            },
        ],
    },
};

export const Hidden: Story = {
    args: { state: GalleryBodyViewState.HIDDEN },
};
