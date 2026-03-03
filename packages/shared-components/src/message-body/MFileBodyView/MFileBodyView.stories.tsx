/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    MFileBodyView,
    MFileBodyViewInfoIcon,
    MFileBodyViewRendering,
    type MFileBodyViewActions,
    type MFileBodyViewSnapshot,
} from "./MFileBodyView";
import { useMockedViewModel } from "../../viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type MFileBodyViewProps = MFileBodyViewSnapshot & MFileBodyViewActions;

const MFileBodyViewWrapperImpl = ({
    onInfoClick,
    onDownloadClick,
    onDownloadLinkClick,
    onDownloadIframeLoad,
    ...snapshotProps
}: MFileBodyViewProps): ReactNode => {
    const vm = useMockedViewModel(snapshotProps, {
        onInfoClick,
        onDownloadClick,
        onDownloadLinkClick,
        onDownloadIframeLoad,
    });

    return <MFileBodyView vm={vm} />;
};

const MFileBodyViewWrapper = withViewDocs(MFileBodyViewWrapperImpl, MFileBodyView);

const meta = {
    title: "MessageBody/MFileBodyView",
    component: MFileBodyViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        rendering: {
            options: Object.entries(MFileBodyViewRendering)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
        icon: {
            options: Object.entries(MFileBodyViewInfoIcon)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
    },
    args: {
        rendering: MFileBodyViewRendering.INFO,
        label: "spec.pdf",
        tooltip: "spec.pdf (22 KB)",
        icon: MFileBodyViewInfoIcon.ATTACHMENT,
        href: "https://example.org/spec.pdf",
        className: "",
    },
} satisfies Meta<typeof MFileBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Export: Story = {
    args: {
        rendering: MFileBodyViewRendering.EXPORT,
    },
};

export const Invalid: Story = {
    args: {
        rendering: MFileBodyViewRendering.INVALID,
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
        icon: MFileBodyViewInfoIcon.AUDIO,
        label: "voice-message.ogg",
    },
};

export const VideoInfo: Story = {
    args: {
        icon: MFileBodyViewInfoIcon.VIDEO,
        label: "clip.mp4",
    },
};

export const UnencryptedDownload: Story = {
    args: {
        rendering: MFileBodyViewRendering.DOWNLOAD_UNENCRYPTED,
    },
};

export const EncryptedIframeDownload: Story = {
    args: {
        rendering: MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_IFRAME,
    },
};

export const EncryptedPendingDownload: Story = {
    args: {
        rendering: MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_PENDING,
    },
};

export const LongFilenameDownload: Story = {
    args: {
        rendering: MFileBodyViewRendering.DOWNLOAD_UNENCRYPTED,
        label: "a very long filename to show ellipsis.pdf",
    },
};
