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

import { ExpandedPreviewTile } from "./ExpandedPreviewTile";

const meta = {
    title: "Room/Timeline/MediaPreviewGroupView/ExpandedPreviewTile",
    component: ExpandedPreviewTile,
    tags: ["autodocs"],
    args: {
        style: "expanded",
        largeImage: "https://picsum.photos/seed/element/480/270",
        icon: <FileIcon />,
        iconOnClick: () => {},
        iconBorder: "var(--Light-color-icon-quaternary-alpha, rgba(1, 21, 50, 0.35))",
        iconBg: "var(--Light-color-bg-decorative-4, #F1EFFF)",
        iconFg: "#4200A6",
        header: "annual-report.pdf",
        body: "2.3 MB",
        buttons: [
            { icon: <ExpandIcon />, onClick: () => ({}) },
            { icon: <DownloadIcon />, onClick: () => ({}) },
        ],
    },
} satisfies Meta<typeof ExpandedPreviewTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithFooter: Story = {
    args: {
        footer: "Shared by Alice · 12:45",
    },
};

export const WithHeaderUrl: Story = {
    args: {
        headerUrl: "https://example.com/annual-report.pdf",
    },
};

export const ClickableImage: Story = {
    args: {
        largeImageOnClick: () => {
            window.alert("Image clicked");
            return {};
        },
    },
};

export const NoButtons: Story = {
    args: {
        buttons: [],
    },
};
