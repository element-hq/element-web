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
    MFileBodyViewinfoIcon,
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
        infoIcon: {
            options: Object.entries(MFileBodyViewinfoIcon)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
        showInfo: {
            control: { type: "boolean" },
        },
        showDownload: {
            control: { type: "boolean" },
        },
    },
    args: {
        rendering: MFileBodyViewRendering.ENCRYPTED_PENDING,
        filename: "spec.pdf",
        showInfo: true,
        infoTooltip: "spec.pdf (22 KB)",
        infoIcon: MFileBodyViewinfoIcon.ATTACHMENT,
        showDownload: false,
        downloadLabel: "Download",
        downloadHref: "https://example.org/spec.pdf",
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
        showDownload: false,
    },
};

export const AudioInfo: Story = {
    args: {
        infoIcon: MFileBodyViewinfoIcon.AUDIO,
        filename: "voice-message.ogg",
    },
};

export const VideoInfo: Story = {
    args: {
        infoIcon: MFileBodyViewinfoIcon.VIDEO,
        filename: "clip.mp4",
    },
};

export const UnencryptedDownload: Story = {
    args: {
        showInfo: false,
        showDownload: true,
        rendering: MFileBodyViewRendering.UNENCRYPTED_DOWNLOAD,
    },
};

export const EncryptedIframeDownload: Story = {
    args: {
        showInfo: false,
        showDownload: true,
        rendering: MFileBodyViewRendering.ENCRYPTED_IFRAME_DOWNLOAD,
    },
};

export const HasExtraClassNames: Story = {
    args: {
        className: "extra_class_1 extra_class_2",
    },
};

export const HasActions: Story = {
    args: {
        onInfoClick: () => console.log("Clicked info"),
        onDownloadClick: () => console.log("Clicked download"),
        onDownloadLinkClick: () => console.log("Clicked download link"),
        onDownloadIframeLoad: () => console.log("Loaded download iframe"),
    },
};
