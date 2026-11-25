/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocumentIcon, ExpandIcon, DownloadIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { VideoPreviewTile } from "./MediaPreviewTile";
// Inlined as a data URI, and short enough to be buffered in full the moment it is decoded: the native
// video controls draw a buffered-progress bar, so a clip that is still downloading when the snapshot
// is taken makes the screenshot non-reproducible.
import demoVideo from "../../../../../../static/videoPreviewDemo.webm?inline";
import { prepareVideosForSnapshot } from "../../../../../../.storybook/prepareVideosForSnapshot";

const meta = {
    title: "Room/Timeline/MediaPreviewGroupView/MediaPreviewTile/VideoPreviewTile",
    component: VideoPreviewTile,
    tags: ["autodocs"],
    args: {
        id: "holiday-clip.mp4",
        type: "video",
        video: demoVideo,
        videoSize: "banner",
        icon: <DocumentIcon />,
        onClick: () => {},
        color: "#4200A6",
        header: "holiday-clip.mp4",
        body: "12.4 MB",
        buttons: [
            { label: "Expand", icon: <ExpandIcon />, onClick: () => ({}) },
            { label: "Download", icon: <DownloadIcon />, onClick: () => ({}) },
        ],
    },
    play: ({ canvasElement }) => prepareVideosForSnapshot(canvasElement),
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/sI9A2kV2K4xeiyqJsL7Ey3/Links-and-Files?node-id=728-8112",
        },
    },
} satisfies Meta<typeof VideoPreviewTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Uncollapsed: Story = {
    args: {
        videoSize: "full",
    },
};

export const TallBanner: Story = {
    args: {
        videoSize: "tallbanner",
    },
};

export const ClickableUncollapsedVideo: Story = {
    args: {
        videoSize: "full",
        videoOnClick: () => {
            return {};
        },
    },
};

export const WithHeaderUrl: Story = {
    args: {
        headerUrl: "https://example.com/holiday-clip.mp4",
    },
};

export const ClickableVideo: Story = {
    args: {
        videoOnClick: () => {},
    },
};

export const NoButtons: Story = {
    args: {
        buttons: [],
    },
};
