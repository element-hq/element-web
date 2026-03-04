/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    FileBodyView,
    FileBodyViewInfoIcon,
    FileBodyViewRendering,
    type FileBodyViewActions,
    type FileBodyViewSnapshot,
} from "./FileBodyView";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type FileBodyViewProps = FileBodyViewSnapshot & FileBodyViewActions;

const FileBodyViewWrapperImpl = ({
    onInfoClick,
    onDownloadClick,
    onDownloadLinkClick,
    onDownloadIframeLoad,
    className,
    ...snapshotProps
}: FileBodyViewProps & { className?: string }): ReactNode => {
    const vm = useMockedViewModel(snapshotProps, {
        onInfoClick,
        onDownloadClick,
        onDownloadLinkClick,
        onDownloadIframeLoad,
    });

    return <FileBodyView vm={vm} className={className} />;
};

const FileBodyViewWrapper = withViewDocs(FileBodyViewWrapperImpl, FileBodyView);

const meta = {
    title: "MessageBody/FileBodyView",
    component: FileBodyViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        rendering: {
            options: Object.entries(FileBodyViewRendering)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
        icon: {
            options: Object.entries(FileBodyViewInfoIcon)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
    },
    args: {
        rendering: FileBodyViewRendering.INFO,
        label: "spec.pdf",
        tooltip: "spec.pdf (22 KB)",
        icon: FileBodyViewInfoIcon.ATTACHMENT,
        href: "https://example.org/spec.pdf",
        className: "",
    },
} satisfies Meta<typeof FileBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Export: Story = {
    args: {
        rendering: FileBodyViewRendering.EXPORT,
    },
};

export const Invalid: Story = {
    args: {
        rendering: FileBodyViewRendering.INVALID,
    },
};

export const LongFilenameInfo: Story = {
    args: {
        label: "a very long filename to show ellipsis.pdf",
        tooltip: "a very long filename to show ellipsis.pdf (12 kB)",
    },
};

export const AudioInfo: Story = {
    args: {
        icon: FileBodyViewInfoIcon.AUDIO,
        label: "voice-message.ogg",
    },
};

export const VideoInfo: Story = {
    args: {
        icon: FileBodyViewInfoIcon.VIDEO,
        label: "clip.mp4",
    },
};

export const UnencryptedDownload: Story = {
    args: {
        rendering: FileBodyViewRendering.DOWNLOAD_UNENCRYPTED,
    },
};

export const EncryptedIframeDownload: Story = {
    args: {
        rendering: FileBodyViewRendering.DOWNLOAD_ENCRYPTED_IFRAME,
    },
};

export const EncryptedPendingDownload: Story = {
    args: {
        rendering: FileBodyViewRendering.DOWNLOAD_ENCRYPTED_PENDING,
    },
};

export const LongFilenameDownload: Story = {
    args: {
        rendering: FileBodyViewRendering.DOWNLOAD_UNENCRYPTED,
        label: "a very long filename to show ellipsis.pdf",
    },
};
