/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocumentIcon, ExpandIcon, DownloadIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { ImagePreviewTile } from "./MediaPreviewTile";
import demoImage from "../../../../../../static/wideImage.png";

const meta = {
    title: "Room/Timeline/MediaPreviewGroupView/MediaPreviewTile/ImagePreviewTile",
    component: ImagePreviewTile,
    tags: ["autodocs"],
    args: {
        id: "annual-report.pdf",
        style: "image",
        image: demoImage,
        imageSize: "banner",
        icon: <DocumentIcon />,
        onClick: () => {},
        color: "#4200A6",
        header: "annual-report.pdf",
        body: "2.3 MB",
        buttons: [
            { label: "Expand", icon: <ExpandIcon />, onClick: () => ({}) },
            { label: "Download", icon: <DownloadIcon />, onClick: () => ({}) },
        ],
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/sI9A2kV2K4xeiyqJsL7Ey3/Links-and-Files?node-id=728-8112",
        },
    },
} satisfies Meta<typeof ImagePreviewTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Uncollapsed: Story = {
    args: {
        imageSize: "full",
    },
};

export const TallBanner: Story = {
    args: {
        imageSize: "tallbanner",
    },
};

export const ClickableUncollapsedImage: Story = {
    args: {
        imageSize: "full",
        imageOnClick: () => {},
    },
};

export const WithHeaderUrl: Story = {
    args: {
        headerUrl: "https://example.com/annual-report.pdf",
    },
};

export const ClickableImage: Story = {
    args: {
        imageOnClick: () => {},
    },
};

export const NoButtons: Story = {
    args: {
        buttons: [],
    },
};
