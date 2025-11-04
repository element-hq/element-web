/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { FileBody } from "./FileBody";

const meta: Meta<typeof FileBody> = {
    title: "Event Tiles/FileBody",
    component: FileBody,
    tags: ["autodocs"],
    args: {
        fileInfo: {
            filename: "Important Document.pdf",
            tooltip: "Important Document.pdf",
            mimeType: "application/pdf",
        },
        downloadLabel: "Download",
        showGenericPlaceholder: true,
        showDownloadLink: true,
        onPlaceholderClick: fn(),
        onDownloadClick: fn(),
    },
};

export default meta;
type Story = StoryObj<typeof FileBody>;

/**
 * Default file body with placeholder and download button
 */
export const Default: Story = {};

/**
 * File body without the generic placeholder
 */
export const WithoutPlaceholder: Story = {
    args: {
        showGenericPlaceholder: false,
    },
};

/**
 * File body without download link
 */
export const WithoutDownloadLink: Story = {
    args: {
        showDownloadLink: false,
    },
};

/**
 * Encrypted file that hasn't been decrypted yet - shows decrypt button
 */
export const EncryptedNotDecrypted: Story = {
    args: {
        isEncrypted: true,
        isDecrypted: false,
        onDecryptClick: fn(),
    },
};

/**
 * Encrypted file that has been decrypted - shows iframe for download
 */
export const EncryptedDecrypted: Story = {
    args: {
        isEncrypted: true,
        isDecrypted: true,
        iframeSrc: "usercontent/",
        onIframeLoad: fn(),
    },
};

/**
 * File body in export mode with a direct link
 */
export const ExportMode: Story = {
    args: {
        forExport: true,
        exportUrl: "mxc://server/file123",
    },
};

/**
 * File body with an error message
 */
export const WithError: Story = {
    args: {
        error: "Invalid file",
    },
};

/**
 * Large file name that will be truncated
 */
export const LongFilename: Story = {
    args: {
        fileInfo: {
            filename: "This is a very long filename that should be truncated when displayed.pdf",
            tooltip: "This is a very long filename that should be truncated when displayed.pdf",
            mimeType: "application/pdf",
        },
    },
};

/**
 * Different file types
 */
export const ImageFile: Story = {
    args: {
        fileInfo: {
            filename: "photo.jpg",
            tooltip: "photo.jpg (2.3 MB)",
            mimeType: "image/jpeg",
        },
    },
};

export const VideoFile: Story = {
    args: {
        fileInfo: {
            filename: "video.mp4",
            tooltip: "video.mp4 (45 MB)",
            mimeType: "video/mp4",
        },
    },
};

export const AudioFile: Story = {
    args: {
        fileInfo: {
            filename: "song.mp3",
            tooltip: "song.mp3 (5.2 MB)",
            mimeType: "audio/mpeg",
        },
    },
};
