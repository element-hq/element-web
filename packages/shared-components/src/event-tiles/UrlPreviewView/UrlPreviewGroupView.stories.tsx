/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";
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
                imageThumb: "https://images.dog.ceo/breeds/kuvasz/n02104029_1369.jpg",
                imageFull: "https://images.dog.ceo/breeds/kuvasz/n02104029_1369.jpg",
            },
        },
    ],
};

export const MultiplePreviews = Template.bind({});
MultiplePreviews.args = {
    previews: [
        {
            title: "One",
            description: "Good dog",
            link: "https://matrix.org",
            image: {
                imageThumb: "https://images.dog.ceo/breeds/otterhound/n02091635_979.jpg",
                imageFull: "https://images.dog.ceo/breeds/otterhound/n02091635_979.jpg",
            },
        },
        {
            title: "Two",
            description: "Good dog",
            link: "https://matrix.org",
            image: {
                imageThumb: "https://images.dog.ceo/breeds/eskimo/n02109961_930.jpg",
                imageFull: "https://images.dog.ceo/breeds/eskimo/n02109961_930.jpg",
            },
        },
        {
            title: "Three",
            description: "Good dog",
            link: "https://matrix.org",
            image: {
                imageThumb: "https://images.dog.ceo/breeds/pekinese/n02086079_22136.jpg",
                imageFull: "https://images.dog.ceo/breeds/pekinese/n02086079_22136.jpg",
            },
        },
    ],
};
