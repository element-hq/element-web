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
import { LinkedTextContext } from "../../utils/LinkedText";

export default {
    title: "Event/UrlPreviewView",
    component: LinkPreview,
    tags: ["autodocs"],
    args: {
        onImageClick: fn(),
    },
} satisfies Meta<typeof LinkPreview>;

const Template: StoryFn<typeof LinkPreview> = (args) => (
    <LinkedTextContext.Provider value={{}}>
        <LinkPreview {...args} />
    </LinkedTextContext.Provider>
);

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
    description: "A simple description with a link to https://matrix.org",
    link: "https://matrix.org",
};

export const WithTooltip = Template.bind({});
WithTooltip.args = {
    title: "A simple title",
    description: "A simple description",
    showTooltipOnLink: true,
    link: "https://matrix.org",
};

export const WithVeryLongText = Template.bind({});
WithVeryLongText.args = {
    title: "GitHub - element-hq/not-a-real-repo: A very very long PR title that should be rendered nicely",
    description:
        "This PR doesn't actually exist and neither does the repository. It might exist one day if we go into the business of making paradoxical repository names.",
    link: "https://matrix.org",
    siteName: "GitHub",
    image: {
        imageThumb: imageFile,
        imageFull: imageFile,
    },
};
