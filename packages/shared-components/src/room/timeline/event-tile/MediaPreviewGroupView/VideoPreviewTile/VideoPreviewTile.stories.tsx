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

import { VideoPreviewTile } from "./VideoPreviewTile";

const meta = {
    title: "Room/Timeline/MediaPreviewGroupView/VideoPreviewTile",
    component: VideoPreviewTile,
    tags: ["autodocs"],
    args: {
        style: "video",
        largeVideo: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        videoSize: "banner",
        icon: <FileIcon />,
        iconOnClick: () => {},
        color: "#4200A6",
        header: "holiday-clip.mp4",
        body: "12.4 MB",
        buttons: [
            { icon: <ExpandIcon />, onClick: () => ({}) },
            { icon: <DownloadIcon />, onClick: () => ({}) },
        ],
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

export const ClickableUncollapsedVideo: Story = {
    args: {
        videoSize: "full",
        largeVideoOnClick: () => {
            window.alert("Video clicked");
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
        largeVideoOnClick: () => {
            window.alert("Video clicked");
            return {};
        },
    },
};

export const NoButtons: Story = {
    args: {
        buttons: [],
    },
};
