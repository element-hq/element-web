/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { LinkPreview } from "./LinkPreview";
import { LinkedTextContext } from "../../../core/utils/LinkedText";
import imageFile from "../../../../static/element.png";
import imageFileWide from "../../../../static/wideImage.png";

export default {
    title: "Event/UrlPreviewGroupView/LinkPreview",
    component: LinkPreview,
    tags: ["autodocs"],
    args: {
        onImageClick: fn(),
    },
    argTypes: {
        siteName: {
            control: "text",
        },
        author: {
            control: "text",
        },
        siteIcon: { control: { type: "file", accept: ".png" } },
        image: {},
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/sI9A2kV2K4xeiyqJsL7Ey3/Link-Previews?node-id=87-7920",
        },
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
        alt: "Element logo",
        playable: false,
    },
};

export const Title = Template.bind({});
Title.args = {
    title: "A simple title",
    link: "https://matrix.org",
    siteName: "matrix.org",
};

export const TitleAndDescription = Template.bind({});
TitleAndDescription.args = {
    title: "A simple title",
    description: "A simple description with a link to https://matrix.org",
    link: "https://matrix.org",
    siteName: "matrix.org",
};

export const WithSiteIcon = Template.bind({});
WithSiteIcon.args = {
    title: "A simple title",
    description: "A simple description with a link to https://matrix.org",
    link: "https://matrix.org",
    siteName: "matrix.org",
    siteIcon: imageFile,
};

export const WithTooltip = Template.bind({});
WithTooltip.args = {
    title: "A simple title",
    description: "A simple description",
    showTooltipOnLink: true,
    link: "https://matrix.org",
    siteName: "matrix.org",
};

export const Article = Template.bind({});
Article.args = {
    title: "A linked article",
    description:
        "This is a basic description returned from the linked source, usually with a word or two about what the link contains.",
    link: "https://matrix.org",
    siteName: "blog.example.org",
    image: {
        imageThumb: imageFileWide,
        imageFull: imageFileWide,
        alt: "A dog",
        playable: false,
    },
};

export const Video = Template.bind({});
Video.args = {
    title: "A linked video",
    description:
        "This is a link to a video. You cannot play the video inline yet, but you can click the play button to open the link",
    link: "https://matrix.org",
    siteName: "blog.example.org",
    image: {
        imageThumb: imageFileWide,
        imageFull: imageFileWide,
        alt: "A dog",
        playable: true,
    },
};

export const Social = Template.bind({});
Social.args = {
    description: "Sending a small message",
    link: "https://matrix.org",
    siteName: "socialsite.example.org",
    title: "Test user (@test)",
    author: "Test user (@test)",
};

export const SocialWithImage = Template.bind({});
SocialWithImage.args = {
    description: "Sending a message with an attached image.",
    title: "Test user (@test)",
    link: "https://matrix.org",
    siteName: "socialsite.example.org",
    author: "Test user (@test)",
    image: {
        imageThumb: imageFileWide,
        imageFull: imageFileWide,
        alt: "A dog",
        playable: false,
    },
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
        alt: "Element logo",
        playable: false,
    },
};
