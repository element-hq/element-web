/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryFn } from "@storybook/react-vite";
import siteIconFile from "../../../../static/element.png";
import imagePreviewFile from "../../../../static/wideImage.png";
import { MessageComposerUrlPreviewView, type MessageComposerUrlPreviewSnapshot } from "./MessageComposerUrlPreview";
import { useMockedViewModel } from "../../../core/viewmodel";
import { LinkedTextContext } from "../../../core/utils/LinkedText";
import { withViewDocs } from "../../../../.storybook/withViewDocs";

type MessageComposerUrlPreviewWrapperProps = MessageComposerUrlPreviewSnapshot;

const MessageComposerUrlPreviewViewWrapperImpl = ({
    ...rest
}: MessageComposerUrlPreviewWrapperProps): JSX.Element | null => {
    const vm = useMockedViewModel(rest, {});
    return (
        <LinkedTextContext.Provider value={{}}>
            <MessageComposerUrlPreviewView vm={vm} />
        </LinkedTextContext.Provider>
    );
};

const MessageComposerUrlPreviewViewWrapper = withViewDocs(
    MessageComposerUrlPreviewViewWrapperImpl,
    MessageComposerUrlPreviewView,
);

export default {
    title: "Composer/MessageComposerUrlPreview",
    component: MessageComposerUrlPreviewViewWrapper,
    tags: ["autodocs"],
    args: {},
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/sI9A2kV2K4xeiyqJsL7Ey3/Link-Previews?node-id=243-8476&t=NNrkR2fxEeVenjbU-0",
        },
    },
} satisfies Meta<typeof MessageComposerUrlPreviewViewWrapper>;

const Template: StoryFn<typeof MessageComposerUrlPreviewViewWrapper> = (args) => (
    <MessageComposerUrlPreviewViewWrapper {...args} />
);

export const Default = Template.bind({});
Default.args = {
    preview: {
        title: "A simple title",
        description: "A simple description",
        link: "https://matrix.org",
        siteName: "matrix.org",
        showTooltipOnLink: false,
    },
};

export const WithImage = Template.bind({});
WithImage.args = {
    preview: {
        ...Default.args.preview!,
        image: {
            imageThumb: imagePreviewFile,
            imageFull: imagePreviewFile,
            alt: "The element logo",
            playable: false,
        },
    },
};
export const WithImageAndSiteIcon = Template.bind({});
WithImageAndSiteIcon.args = {
    preview: {
        ...Default.args.preview!,
        siteIcon: siteIconFile,
        image: {
            imageThumb: imagePreviewFile,
            imageFull: imagePreviewFile,
            alt: "The element logo",
            playable: false,
        },
    },
};

export const WithImageAndLoadsOfText = Template.bind({});
WithImageAndLoadsOfText.args = {
    preview: {
        ...Default.args.preview!,
        description: `Molestiae aliquam quos possimus molestiae id sit nulla rerum. Sunt cumque illum alias. Illo ipsa ut iure quia nulla magnam repellat.

    Esse velit corporis sapiente temporibus quia ipsam. Pariatur est rem veritatis. Inventore sit consequatur odio ipsa error non assumenda. Est eum ex dignissimos voluptatibus voluptatem delectus modi. Nisi quia eius ea quibusdam. Aut eveniet maxime non.

    Impedit qui minus soluta cupiditate. Illo blanditiis sint et dolores rem consequuntur rerum ut. Delectus tempore dolorem veritatis odit enim ut dolores. Sit quae rerum explicabo consequatur tenetur. Labore in doloremque libero.

    Incidunt ut ea quae nobis. Reiciendis inventore quas qui eum voluptatem ex et qui. Adipisci quibusdam dolores hic inventore et suscipit cupiditate consequuntur.

    Temporibus similique sint quo. Omnis tempora quidem explicabo in quidem magnam quia. Aut sunt accusantium ut et ut laborum debitis in. Enim nihil sit consectetur facilis quidem voluptatem. Quod impedit odit veritatis est laudantium tempore sit labore. Atque minima aliquam nostrum et.`,
        image: {
            imageThumb: imagePreviewFile,
            imageFull: imagePreviewFile,
            alt: "The element logo",
            playable: false,
        },
    },
};
