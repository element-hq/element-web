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

import { TextPreviewTile } from "./MediaPreviewTile";

const meta = {
    title: "Room/Timeline/MediaPreviewGroupView/MediaPreviewTile/TextPreviewTile",
    component: TextPreviewTile,
    tags: ["autodocs"],
    args: {
        id: "annual-report.pdf",
        style: "text",
        icon: <FileIcon />,
        onClick: () => {},
        color: "#4200A6",
        header: "annual-report.pdf",
        body: "2.3 MB",
        buttons: [
            { label: "Expand", icon: <ExpandIcon />, onClick: () => ({}) },
            { label: "Download", icon: <DownloadIcon />, onClick: () => ({}) },
        ],
    },
} satisfies Meta<typeof TextPreviewTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHeaderUrl: Story = {
    args: {
        headerUrl: "https://example.com/annual-report.pdf",
    },
};

export const NoButtons: Story = {
    args: {
        buttons: [],
    },
};

export const ClickableIcon: Story = {
    args: {
        onClick: () => {},
    },
};
