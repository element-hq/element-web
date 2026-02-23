/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import imageFile from "../../../static/element.png";
import type { Meta, StoryFn } from "@storybook/react-vite";
import {
    UrlPreviewGroupView,
    type UrlPreviewGroupViewActions,
    type UrlPreviewGroupViewSnapshot,
} from "./UrlPreviewGroupView";
import { useMockedViewModel } from "../../viewmodel";

type UrlPreviewGroupViewProps = UrlPreviewGroupViewSnapshot & UrlPreviewGroupViewActions;

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
    return <UrlPreviewGroupView vm={vm} />;
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
} as Meta<typeof UrlPreviewGroupViewWrapper>;

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

export const MultiplePreviews = Template.bind({});
MultiplePreviews.args = {
    previews: [
        {
            title: "One",
            description: "Great description",
            link: "https://matrix.org",
            image: {
                imageThumb: imageFile,
                imageFull: imageFile,
            },
        },
        {
            title: "Two",
            description: "Another description",
            link: "https://matrix.org",
            image: {
                imageThumb: imageFile,
                imageFull: imageFile,
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
