/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import squareImage from "../../../../static/element.png";
import tallImage from "../../../../static/tallImage.png";
import wideImage from "../../../../static/wideImage.png";
import { useMockedViewModel } from "../../../core/viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";
import {
    GalleryComposerView,
    type GalleryComposerViewActions,
    type GalleryComposerViewItem,
    type GalleryComposerViewSnapshot,
} from "./GalleryComposerView";

type GalleryComposerViewProps = GalleryComposerViewSnapshot & GalleryComposerViewActions & { className?: string };

const GalleryComposerViewWrapperImpl = ({
    onAddFiles,
    onRemoveItem,
    onOpenItem,
    className,
    ...snapshotProps
}: GalleryComposerViewProps): ReactNode => {
    const vm = useMockedViewModel(snapshotProps, { onAddFiles, onRemoveItem, onOpenItem });

    return <GalleryComposerView vm={vm} className={className} />;
};

const GalleryComposerViewWrapper = withViewDocs(GalleryComposerViewWrapperImpl, GalleryComposerView);

const images = [
    { name: "wide.png", src: wideImage },
    { name: "tall.png", src: tallImage },
    { name: "square.png", src: squareImage },
];

function makeItems(count: number): GalleryComposerViewItem[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `item-${index}`,
        type: "image",
        name: images[index % images.length].name,
        previewUrl: images[index % images.length].src,
    }));
}

const meta = {
    title: "Room/GalleryComposerView",
    component: GalleryComposerViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        className: { control: "text" },
    },
    args: {
        items: makeItems(3),
        canAddMore: true,
        countLabel: "3 of 60 items",
        notice: undefined,
        disabled: false,
        onAddFiles: fn(),
        onRemoveItem: fn(),
        className: "",
    },
    decorators: [
        (Story) => (
            <div style={{ width: 520 }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof GalleryComposerViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithVideo: Story = {
    args: {
        items: [
            ...makeItems(2),
            // A video which was already sent is previewed with its thumbnail, which is an image.
            { id: "video", type: "video", name: "clip.mp4", previewUrl: wideImage, previewIsVideo: false },
        ],
    },
};

export const Loading: Story = {
    args: {
        items: [...makeItems(2), { id: "loading", type: "image", name: "loading.png", loading: true }],
    },
};

export const Full: Story = {
    args: {
        items: makeItems(6),
        canAddMore: false,
        countLabel: "60 of 60 items",
        notice: "A gallery can hold up to 60 items. The rest were left out.",
    },
};

export const Empty: Story = {
    args: { items: [], countLabel: "0 of 60 items" },
};

export const Disabled: Story = {
    args: { disabled: true },
};

/** A warning about how the attachments will be sent. */
export const WithHint: Story = {
    args: {
        hint: "You've added more than one image or video, so this will be sent as a gallery. People using older apps will only see your text, not the images.",
    },
};

/** Each preview opens the item at full size, as it does in the app. */
export const Openable: Story = {
    args: { onOpenItem: fn() },
};
