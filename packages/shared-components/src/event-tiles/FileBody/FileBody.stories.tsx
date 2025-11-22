/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import type { Meta, StoryFn } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { FileBody, type FileBodyViewSnapshot, type FileBodyActions } from "./FileBody";
import { useMockedViewModel } from "../../useMockedViewModel";

type FileBodyProps = FileBodyViewSnapshot & FileBodyActions;

const FileBodyWrapper = ({
    onPlaceholderClick,
    onDownloadClick,
    onDecryptClick,
    onIframeLoad,
    ...rest
}: FileBodyProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onPlaceholderClick,
        onDownloadClick,
        onDecryptClick,
        onIframeLoad,
    });
    return <FileBody vm={vm} />;
};

const meta: Meta<typeof FileBodyWrapper> = {
    title: "Event Tiles/FileBody",
    component: FileBodyWrapper,
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
        isEncrypted: false,
        isDecrypted: false,
        forExport: false,
        onPlaceholderClick: fn(),
        onDownloadClick: fn(),
        onDecryptClick: fn(),
        onIframeLoad: fn(),
    },
};

export default meta;

const Template: StoryFn<typeof FileBodyWrapper> = (args) => <FileBodyWrapper {...args} />;

/**
 * Default file body with placeholder and download button
 */
export const Default = Template.bind({});

/**
 * File body without the generic placeholder
 */
export const WithoutPlaceholder = Template.bind({});
WithoutPlaceholder.args = {
    showGenericPlaceholder: false,
};

/**
 * File body without download link
 */
export const WithoutDownloadLink = Template.bind({});
WithoutDownloadLink.args = {
    showDownloadLink: false,
};

/**
 * Encrypted file that hasn't been decrypted yet - shows decrypt button
 */
export const EncryptedNotDecrypted = Template.bind({});
EncryptedNotDecrypted.args = {
    isEncrypted: true,
    isDecrypted: false,
};

/**
 * Encrypted file that has been decrypted - shows iframe for download
 */
export const EncryptedDecrypted = Template.bind({});
EncryptedDecrypted.args = {
    isEncrypted: true,
    isDecrypted: true,
    iframeSrc: "usercontent/",
};

/**
 * File body in export mode with a direct link
 */
export const ExportMode = Template.bind({});
ExportMode.args = {
    forExport: true,
    exportUrl: "mxc://server/file123",
};

/**
 * File body with an error message
 */
export const WithError = Template.bind({});
WithError.args = {
    error: "Invalid file",
};

/**
 * Large file name that will be truncated
 */
export const LongFilename = Template.bind({});
LongFilename.args = {
    fileInfo: {
        filename: "This is a very long filename that should be truncated when displayed.pdf",
        tooltip: "This is a very long filename that should be truncated when displayed.pdf",
        mimeType: "application/pdf",
    },
};

/**
 * Different file types
 */
export const ImageFile = Template.bind({});
ImageFile.args = {
    fileInfo: {
        filename: "photo.jpg",
        tooltip: "photo.jpg (2.3 MB)",
        mimeType: "image/jpeg",
    },
};

export const VideoFile = Template.bind({});
VideoFile.args = {
    fileInfo: {
        filename: "video.mp4",
        tooltip: "video.mp4 (45 MB)",
        mimeType: "video/mp4",
    },
};

export const AudioFile = Template.bind({});
AudioFile.args = {
    fileInfo: {
        filename: "song.mp3",
        tooltip: "song.mp3 (5.2 MB)",
        mimeType: "audio/mpeg",
    },
};
