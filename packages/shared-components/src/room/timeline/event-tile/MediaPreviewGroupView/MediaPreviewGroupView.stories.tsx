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

import {
    MediaPreviewGroupPreview,
    type MediaPreviewGroupEntry,
    type MediaPreviewGroupSnapshot,
} from "./MediaPreviewGroupView";
import { MockViewModel } from "../../../../core/viewmodel/MockViewModel";

const buttons = [
    { icon: <ExpandIcon />, onClick: () => ({}) },
    { icon: <DownloadIcon />, onClick: () => ({}) },
];

const textEntry: MediaPreviewGroupEntry = {
    style: "text",
    icon: <FileIcon />,
    color: "#4200A6",
    header: "annual-report.pdf",
    body: "2.3 MB",
    buttons,
};

const imageEntry: MediaPreviewGroupEntry = {
    style: "image",
    image: "https://picsum.photos/seed/element/480/270",
    imageSize: "banner",
    icon: <FileIcon />,
    color: "#4200A6",
    header: "screenshot.png",
    body: "820 KB",
    buttons,
};

const videoEntry: MediaPreviewGroupEntry = {
    style: "video",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    videoSize: "banner",
    icon: <FileIcon />,
    color: "#4200A6",
    header: "holiday-clip.mp4",
    body: "12.4 MB",
    buttons,
};

const audioEntry: MediaPreviewGroupEntry = {
    style: "audio",
    audio: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
    icon: <FileIcon />,
    color: "#4200A6",
    header: "voice-message.mp3",
    body: "1.1 MB",
    buttons,
};

const withEntries = (entries: Array<MediaPreviewGroupEntry>): { vm: MockViewModel<MediaPreviewGroupSnapshot> } => ({
    vm: new MockViewModel<MediaPreviewGroupSnapshot>({ entries }),
});

const meta = {
    title: "Room/Timeline/MediaPreviewGroupView/MediaPreviewGroupView",
    component: MediaPreviewGroupPreview,
    tags: ["autodocs"],
} satisfies Meta<typeof MediaPreviewGroupPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllTypes: Story = {
    args: withEntries([textEntry, imageEntry, videoEntry, audioEntry]),
};

export const SingleText: Story = {
    args: withEntries([textEntry]),
};

export const SingleImage: Story = {
    args: withEntries([imageEntry]),
};

export const SingleVideo: Story = {
    args: withEntries([videoEntry]),
};

export const SingleAudio: Story = {
    args: withEntries([audioEntry]),
};

export const Collapsed: Story = {
    args: {
        ...withEntries([textEntry, imageEntry]),
        collapse: { collapsed: true, hiddenCount: 3, onToggle: () => ({}) },
    },
};

export const Expanded: Story = {
    args: {
        ...withEntries([textEntry, imageEntry, videoEntry, audioEntry]),
        collapse: { collapsed: false, hiddenCount: 0, onToggle: () => ({}) },
    },
};
