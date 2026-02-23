/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import imageFile from "../../../static/element.png";

import { LinkPreview } from "./LinkPreview";

export default {
    title: "Event/UrlPreviewView",
    component: LinkPreview,
    tags: ["autodocs"],
    args: {
        onHideClick: fn(),
        onImageClick: fn(),
    },
} as Meta<typeof LinkPreview>;

const Template: StoryFn<typeof LinkPreview> = (args) => <LinkPreview {...args} />;

export const Default = Template.bind({});
Default.args = {
    title: "A simple title",
    description: "A simple description",
    link: "https://matrix.org",
    siteName: "Site name",
    image: {
        imageThumb: imageFile,
        imageFull: imageFile,
    },
};

export const Title = Template.bind({});
Title.args = {
    title: "A simple title",
    link: "https://matrix.org",
};

export const TitleAndDescription = Template.bind({});
TitleAndDescription.args = {
    title: "A simple title",
    description: "A simple description",
    link: "https://matrix.org",
};

export const WithTooltip = Template.bind({});
WithTooltip.args = {
    title: "A simple title",
    description: "A simple description",
    showTooltipOnLink: true,
    link: "https://matrix.org",
};

export const WithCompactLayout = Template.bind({});
WithCompactLayout.args = {
    compactLayout: true,
    title: "A simple title",
    description: "A simple description",
    link: "https://matrix.org",
    siteName: "Site name",
    image: {
        imageThumb: imageFile,
        imageFull: imageFile,
    },
};
