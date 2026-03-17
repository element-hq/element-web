/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import imageFile from "../../../static/element.png";
import tallImageFile from "../../../static/tallImage.png";
import type { Meta, StoryFn } from "@storybook/react-vite";
import { UrlPreviewGroupView, type UrlPreviewViewActions, type UrlPreviewViewSnapshot } from "./UrlPreviewGroupView";
import { useMockedViewModel } from "../../viewmodel";
import { LinkedTextContext } from "../../utils/LinkedText";

type UrlPreviewGroupViewProps = UrlPreviewViewSnapshot & UrlPreviewViewActions;

const UrlPreviewGroupViewWrapper = ({
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

export default {
    title: "Event/UrlPreviewGroupView",
    component: UrlPreviewGroupViewWrapper,
    tags: ["autodocs"],
    args: {
        onHideClick: fn(),
        onImageClick: fn(),
        onTogglePreviewLimit: fn(),
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
            image: {
                imageThumb: imageFile,
                imageFull: imageFile,
            },
        },
    ],
};

export const MultiplePreviewsHidden = Template.bind({});
MultiplePreviewsHidden.args = {
    previews: [
        {
            title: "A simple title",
            description: "A simple description",
            link: "https://matrix.org",
            image: {
                imageThumb: imageFile,
                imageFull: imageFile,
            },
        },
    ],
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
            link: "https://matrix.org",
            image: {
                imageThumb: imageFile,
                imageFull: imageFile,
            },
        },
        // These images should appear the same size despite having different dimensions.
        {
            title: "Two",
            description: "This one has a taller image which should crop nicely.",
            link: "https://matrix.org",
            image: {
                imageThumb: tallImageFile,
                imageFull: tallImageFile,
            },
        },
        {
            title: "Three",
            description: "One more description",
            link: "https://matrix.org",
            image: {
                imageThumb: imageFile,
                imageFull: imageFile,
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
    compactLayout: true,
};
