/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import FileIcon from "@vector-im/compound-design-tokens/assets/web/icons/document";
import ExpandIcon from "@vector-im/compound-design-tokens/assets/web/icons/expand";
import DownloadIcon from "@vector-im/compound-design-tokens/assets/web/icons/download";

import { VideoPreviewTile } from "./MediaPreviewTile";
import demoVideo from "../../../../../../static/videoBodyDemo.webm";
import { waitForBufferedVideos } from "../../../../../../.storybook/waitForBufferedVideos";

const meta = {
    title: "Room/Timeline/MediaPreviewGroupView/MediaPreviewTile/VideoPreviewTile",
    component: VideoPreviewTile,
    tags: ["autodocs"],
    args: {
        id: "holiday-clip.mp4",
        style: "video",
        video: demoVideo,
        videoSize: "banner",
        icon: <FileIcon />,
        iconOnClick: () => {},
        color: "#4200A6",
        header: "holiday-clip.mp4",
        body: "12.4 MB",
        buttons: [
            { label: "Expand", icon: <ExpandIcon />, onClick: () => ({}) },
            { label: "Download", icon: <DownloadIcon />, onClick: () => ({}) },
        ],
    },
    play: ({ canvasElement }) => waitForBufferedVideos(canvasElement),
} satisfies Meta<typeof VideoPreviewTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Uncollapsed: Story = {
    args: {
        videoSize: "full",
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
