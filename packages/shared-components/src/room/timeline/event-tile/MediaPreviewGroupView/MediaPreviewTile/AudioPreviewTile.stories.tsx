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

import { AudioPreviewTile } from "./MediaPreviewTile";

const meta = {
    title: "Room/Timeline/MediaPreviewGroupView/MediaPreviewTile/AudioPreviewTile",
    component: AudioPreviewTile,
    tags: ["autodocs"],
    args: {
        id: "voice-message.mp3",
        style: "audio",
        audio: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
        icon: <FileIcon />,
        iconOnClick: () => {},
        color: "#4200A6",
        header: "voice-message.mp3",
        body: "1.1 MB",
        buttons: [
            { label: "Expand", icon: <ExpandIcon />, onClick: () => ({}) },
            { label: "Download", icon: <DownloadIcon />, onClick: () => ({}) },
        ],
    },
} satisfies Meta<typeof AudioPreviewTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ClickableAudio: Story = {
    args: {
        audioOnClick: () => {},
    },
};

export const WithHeaderUrl: Story = {
    args: {
        headerUrl: "https://example.com/voice-message.mp3",
    },
};

export const NoButtons: Story = {
    args: {
        buttons: [],
    },
};
