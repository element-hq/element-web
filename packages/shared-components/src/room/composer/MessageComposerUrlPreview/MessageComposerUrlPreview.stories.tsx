/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";
import type { Meta, StoryFn } from "@storybook/react-vite";

import siteIconFile from "../../../../static/element.png";
import wideImageFile from "../../../../static/wideImage.png";
import tallImageFile from "../../../../static/tallImage.png";
import {
    type MessageComposerUrlPreviewSnapshotEntry,
    MessageComposerUrlPreviewView,
    type MessageComposerUrlPreviewSnapshot,
} from "./MessageComposerUrlPreview";
import { useMockedViewModel } from "../../../core/viewmodel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";

type MessageComposerUrlPreviewWrapperProps = Pick<MessageComposerUrlPreviewSnapshot, "entries"> & {
    /**
     * Set to render the remove buttons, as the app does when the URL preview bundle feature is enabled.
     */
    removePreview?: (url: string) => void;
};

const MessageComposerUrlPreviewViewWrapperImpl = ({
    removePreview,
    entries,
}: MessageComposerUrlPreviewWrapperProps): JSX.Element | null => {
    const vm = useMockedViewModel(
        {
            entries,
            content: entries.map((entry) => entry.matched_url).join(" "),
            contentLinks: new Set(entries.map((entry) => entry.matched_url)),
            isModified: false,
        },
        {},
    );
    return (
        <div style={{ maxWidth: 480 }}>
            <MessageComposerUrlPreviewView vm={vm} removePreview={removePreview} />
        </div>
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

const imageEntry = {
    status: "loaded",
    matched_url: "https://www.bbc.co.uk/news/business-56559073",
    include: true,
    preview: {
        title: "UK economy rebounds as Covid restrictions ease",
        description: "The economy grew faster than expected in March.",
        link: "https://www.bbc.co.uk/news/business-56559073",
        siteName: "BBC News",
        showTooltipOnLink: false,
        image: {
            imageThumb: wideImageFile,
            imageFull: wideImageFile,
            alt: "",
            playable: false,
            mxcImageFull: "mxc://server/wide",
        },
    },
} satisfies MessageComposerUrlPreviewSnapshotEntry;

const logoEntry = {
    status: "loaded",
    matched_url: "https://github.com/element-hq/element-web/issues/12490",
    include: true,
    preview: {
        title: "filepanel is missing entries · Issue #12490",
        link: "https://github.com/element-hq/element-web/issues/12490",
        siteName: "GitHub",
        showTooltipOnLink: false,
        siteIcon: siteIconFile,
    },
} satisfies MessageComposerUrlPreviewSnapshotEntry;

const tallImageEntry = {
    status: "loaded",
    matched_url: "https://nextcloud.com/s/frog",
    include: true,
    preview: {
        title: "Frog.jpg",
        link: "https://nextcloud.com/s/frog",
        siteName: "Nextcloud",
        showTooltipOnLink: false,
        image: {
            imageThumb: tallImageFile,
            imageFull: tallImageFile,
            alt: "",
            playable: false,
            mxcImageFull: "mxc://server/tall",
        },
    },
} satisfies MessageComposerUrlPreviewSnapshotEntry;

const plainEntry = {
    status: "loaded",
    matched_url: "https://matrix.org",
    include: true,
    preview: {
        title: "Matrix.org",
        link: "https://matrix.org",
        siteName: "matrix.org",
        showTooltipOnLink: false,
    },
} satisfies MessageComposerUrlPreviewSnapshotEntry;

export const Default = Template.bind({});
Default.args = {
    entries: [imageEntry],
};

/**
 * One card per link: a preview image, a site logo, and a link with neither.
 */
export const MultipleLinks = Template.bind({});
MultipleLinks.args = {
    entries: [imageEntry, logoEntry, tallImageEntry, plainEntry],
};

export const WithLongTitle = Template.bind({});
WithLongTitle.args = {
    entries: [
        {
            ...logoEntry,
            preview: {
                ...logoEntry.preview,
                title: "A very long title which does not fit on one line and so is cut off with an ellipsis at the end",
            },
        },
    ],
};

export const LoadingAndFailed = Template.bind({});
LoadingAndFailed.args = {
    entries: [
        imageEntry,
        { status: "loading", matched_url: "https://element.io", include: true },
        { status: "failed", matched_url: "https://example.com", include: true },
    ],
};

/**
 * The app only passes `removePreview` when the URL preview bundle feature is enabled, which adds the remove
 * button beside each card.
 */
export const WithRemoveButtons = Template.bind({});
WithRemoveButtons.args = {
    entries: [imageEntry, logoEntry, tallImageEntry],
    removePreview: fn(),
};
