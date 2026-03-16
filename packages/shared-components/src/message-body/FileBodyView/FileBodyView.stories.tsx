/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";
import { expect, userEvent, within } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    FileBodyView,
    FileBodyViewInfoIcon,
    FileBodyViewState,
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
        state: {
            options: Object.entries(FileBodyViewState)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
        infoIcon: {
            options: Object.entries(FileBodyViewInfoIcon)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
        showInfo: { control: "boolean" },
        showDownload: { control: "boolean" },
        className: { control: "text" },
    },
    args: {
        state: FileBodyViewState.UNENCRYPTED,
        showInfo: true,
        infoLabel: "spec.pdf",
        infoTooltip: "spec.pdf (22 KB)",
        infoIcon: FileBodyViewInfoIcon.ATTACHMENT,
        infoHref: "https://example.org/spec.pdf",
        showDownload: true,
        downloadLabel: "Download file",
        downloadTitle: "Download title",
        downloadHref: "https://example.org/download/spec.pdf",
        className: undefined,
    },
} satisfies Meta<typeof FileBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Export: Story = {
    args: {
        state: FileBodyViewState.EXPORT,
    },
};

export const Invalid: Story = {
    args: {
        state: FileBodyViewState.INVALID,
    },
};

export const LongFilenameInfo: Story = {
    args: {
        showDownload: false,
        infoLabel: "a very long filename to show ellipsis.pdf",
        infoTooltip: "a very long filename to show ellipsis.pdf (12 kB)",
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.hover(canvas.getByText("a very long filename to show ellipsis.pdf"));
        await expect(
            within(canvasElement.ownerDocument.body).findByText("a very long filename to show ellipsis.pdf (12 kB)"),
        ).resolves.toBeInTheDocument();
    },
};

export const AudioInfo: Story = {
    args: {
        showDownload: false,
        infoIcon: FileBodyViewInfoIcon.AUDIO,
        infoLabel: "voice-message.ogg",
    },
};

export const VideoInfo: Story = {
    args: {
        showDownload: false,
        infoIcon: FileBodyViewInfoIcon.VIDEO,
        infoLabel: "clip.mp4",
    },
};

export const UnencryptedDownload: Story = {
    args: {
        state: FileBodyViewState.UNENCRYPTED,
        showInfo: false,
    },
};

export const EncryptedIframeDownload: Story = {
    args: {
        state: FileBodyViewState.ENCRYPTED,
        showInfo: false,
    },
};

export const DecryptionPendingDownload: Story = {
    args: {
        state: FileBodyViewState.DECRYPTION_PENDING,
        showInfo: false,
    },
};

export const LongFilenameDownload: Story = {
    args: {
        state: FileBodyViewState.UNENCRYPTED,
        showInfo: false,
        showDownload: true,
        downloadLabel: "a very long filename that show no ellipsis.pdf",
    },
};
