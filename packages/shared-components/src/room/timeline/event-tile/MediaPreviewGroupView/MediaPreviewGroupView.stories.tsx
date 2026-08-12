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
import demoImage from "../../../../../static/wideImage.png";
// Inlined as a data URI, and short enough to be buffered in full the moment it is decoded: the native
// video controls draw a buffered-progress bar, so a clip that is still downloading when the snapshot
// is taken makes the screenshot non-reproducible.
import demoVideo from "../../../../../static/videoPreviewDemo.webm?inline";
import demoAudio from "../../../../../static/audioDemo.ogg";
import { prepareVideosForSnapshot } from "../../../../../.storybook/prepareVideosForSnapshot";

const buttons = [
    { label: "Expand", icon: <ExpandIcon />, onClick: () => ({}) },
    { label: "Download", icon: <DownloadIcon />, onClick: () => ({}) },
];

const textEntry: MediaPreviewGroupEntry = {
    id: "annual-report.pdf",
    style: "text",
    icon: <FileIcon />,
    color: "#4200A6",
    header: "annual-report.pdf",
    body: "2.3 MB",
    buttons,
};

const imageEntry: MediaPreviewGroupEntry = {
    id: "screenshot.png",
    style: "image",
    image: demoImage,
    imageSize: "banner",
    icon: <FileIcon />,
    color: "#4200A6",
    header: "screenshot.png",
    body: "820 KB",
    buttons,
};

const videoEntry: MediaPreviewGroupEntry = {
    id: "holiday-clip.mp4",
    style: "video",
    video: demoVideo,
    videoSize: "banner",
    icon: <FileIcon />,
    color: "#4200A6",
    header: "holiday-clip.mp4",
    body: "12.4 MB",
    buttons,
};

const audioEntry: MediaPreviewGroupEntry = {
    id: "voice-message.mp3",
    style: "audio",
    audio: demoAudio,
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
    play: ({ canvasElement }) => prepareVideosForSnapshot(canvasElement),
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
