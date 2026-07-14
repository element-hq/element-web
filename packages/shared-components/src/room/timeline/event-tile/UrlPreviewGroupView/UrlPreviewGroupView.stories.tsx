/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import imageFile from "../../../../../static/element.png";
import tallImageFile from "../../../../../static/tallImage.png";
import type { Decorator, Meta, StoryFn } from "@storybook/react-vite";
import {
    UrlPreviewGroupView,
    type UrlPreviewGroupViewActions,
    type UrlPreviewGroupViewSnapshot,
} from "./UrlPreviewGroupView";
import { useMockedViewModel } from "../../../../core/viewmodel";
import { LinkedTextContext } from "../../../../core/utils/LinkedText";
import { withViewDocs } from "../../../../../.storybook/withViewDocs";

type UrlPreviewGroupViewProps = UrlPreviewGroupViewSnapshot & UrlPreviewGroupViewActions;

const UrlPreviewGroupViewWrapperImpl = ({
    onHideClick,
    onImageClick,
    onTogglePreviewLimit,
    ...rest
}: UrlPreviewGroupViewProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onHideClick,
        onImageClick,
        onTogglePreviewLimit,
    });
    return (
        <LinkedTextContext.Provider value={{}}>
            <UrlPreviewGroupView vm={vm} />
        </LinkedTextContext.Provider>
    );
};

const UrlPreviewGroupViewWrapper = withViewDocs(UrlPreviewGroupViewWrapperImpl, UrlPreviewGroupView);

/**
 * Mimics the CSS context of .mx_EventTile_line (bubble layout) + TextualBodyView.root that
 * surrounds UrlPreviewGroupView in the real app.
 */
const withBubbleLayoutContext: Decorator = (Story) => (
    <div
        style={{
            display: "flex",
            width: "fit-content",
            maxWidth: "70%",
            padding: "9px 60px 9px 9px",
            background: "var(--cpd-color-bg-subtle-primary)",
            borderRadius: "12px",
        }}
    >
        <div style={{ overflowX: "hidden", overflowY: "hidden", maxWidth: "100%" }}>
            <Story />
        </div>
    </div>
);

export default {
    title: "Timeline/Timeline Event/UrlPreviewGroupView",
    component: UrlPreviewGroupViewWrapper,
    tags: ["autodocs"],
    args: {
        onHideClick: fn(),
        onImageClick: fn(),
        onTogglePreviewLimit: fn(),
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/sI9A2kV2K4xeiyqJsL7Ey3/Link-Previews?node-id=87-7920",
        },
    },
} satisfies Meta<typeof UrlPreviewGroupViewWrapper>;

const Template: StoryFn<typeof UrlPreviewGroupViewWrapper> = (args) => <UrlPreviewGroupViewWrapper {...args} />;

export const Default = Template.bind({});
Default.args = {
    previews: [
        {
            title: "A simple title",
            description: "A simple description",
            link: "https://matrix.org",
            showTooltipOnLink: false,
            siteName: "matrix.org",
            image: {
                imageThumb: imageFile,
                imageFull: imageFile,
                alt: "The element logo",
                playable: false,
                mxcImageFull: "mxc://server/file",
            },
        },
    ],
};

export const MultiplePreviewsHidden = Template.bind({});
MultiplePreviewsHidden.args = {
    previews: Default.args.previews,
    overPreviewLimit: true,
    previewsLimited: true,
    totalPreviewCount: 10,
};

export const MultiplePreviewsVisible = Template.bind({});
MultiplePreviewsVisible.args = {
    previews: [
        {
            title: "One",
            description: "A regular square image.",
            link: "https://matrix.org/one",
            siteName: "matrix.org",
            showTooltipOnLink: false,
            image: {
                imageThumb: imageFile,
                imageFull: imageFile,
                alt: "The element logo",
                playable: false,
                mxcImageFull: "mxc://server/file",
            },
        },
        // These images should appear the same size despite having different dimensions.
        {
            title: "Two",
            description: "This one has a taller image which should crop nicely.",
            link: "https://matrix.org/two",
            siteName: "matrix.org",
            showTooltipOnLink: false,
            image: {
                imageThumb: tallImageFile,
                imageFull: tallImageFile,
                alt: "A dog",
                playable: false,
                mxcImageFull: "mxc://server/file",
            },
        },
        {
            title: "Three",
            description: "One more description",
            link: "https://matrix.org/three",
            siteName: "matrix.org",
            showTooltipOnLink: false,
            image: {
                imageThumb: imageFile,
                imageFull: imageFile,
                alt: "The element logo",
                playable: false,
                mxcImageFull: "mxc://server/file",
            },
        },
    ],
    overPreviewLimit: true,
    previewsLimited: false,
    totalPreviewCount: 10,
};

export const WithCompactView = Template.bind({});
WithCompactView.args = {
    ...MultiplePreviewsVisible.args,
};
WithCompactView.globals = {
    eventDensity: "compact",
};

// Testing that within the bubble layout, we still scale appropriately.

export const InBubbleLayout = Default.bind({});
InBubbleLayout.args = {
    ...Default.args,
};
InBubbleLayout.globals = { eventLayout: "bubble" };
// Purely for testing that bubbles have not regressed
InBubbleLayout.tags = ["!autodocs"];
InBubbleLayout.decorators = [withBubbleLayoutContext];

export const InBubbleLayoutNarrow = Default.bind({});
InBubbleLayoutNarrow.args = {
    ...InBubbleLayout.args,
};
InBubbleLayoutNarrow.globals = { ...InBubbleLayout.globals };
InBubbleLayoutNarrow.decorators = [...InBubbleLayout.decorators];
InBubbleLayoutNarrow.parameters = {
    initialGlobals: {
        viewport: { value: "mobile1", isRotated: false },
    },
};
