/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import posterImage from "../../../../../../static/element.png";
import {
    VideoBodyView,
    VideoBodyViewState,
    type VideoBodyViewActions,
    type VideoBodyViewSnapshot,
} from "./VideoBodyView";
import { useMockedViewModel } from "../../../../../core/viewmodel/useMockedViewModel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";

const demoVideo = new URL("../../../../../../static/videoBodyDemo.webm", import.meta.url).href;

type VideoBodyViewProps = VideoBodyViewSnapshot &
    VideoBodyViewActions & {
        className?: string;
        children?: ReactNode;
    };

const VideoBodyViewWrapperImpl = ({
    onPreviewClick,
    onPlay,
    className,
    children,
    ...snapshotProps
}: VideoBodyViewProps): ReactNode => {
    const vm = useMockedViewModel(snapshotProps, { onPreviewClick, onPlay });

    return (
        <VideoBodyView vm={vm} className={className}>
            {children}
        </VideoBodyView>
    );
};

const VideoBodyViewWrapper = withViewDocs(VideoBodyViewWrapperImpl, VideoBodyView);

const meta = {
    title: "Room/Timeline/EventTile/Body/MVideoBodyView/VideoBodyView",
    component: VideoBodyViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        state: {
            options: Object.entries(VideoBodyViewState)
                .filter(([key, value]) => key === value)
                .map(([key]) => key),
            control: { type: "select" },
        },
        className: { control: "text" },
    },
    args: {
        state: VideoBodyViewState.READY,
        videoLabel: "Product demo video",
        hiddenButtonLabel: "Show video",
        errorLabel: "Error decrypting video",
        maxWidth: 320,
        maxHeight: 180,
        aspectRatio: "16/9",
        src: demoVideo,
        poster: posterImage,
        preload: "none",
        controls: true,
        muted: false,
        autoPlay: false,
        className: undefined,
        children: <div>File body slot</div>,
    },
} satisfies Meta<typeof VideoBodyViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Hidden: Story = {
    args: {
        state: VideoBodyViewState.HIDDEN,
    },
};

export const Loading: Story = {
    args: {
        state: VideoBodyViewState.LOADING,
    },
};

export const ErrorState: Story = {
    args: {
        state: VideoBodyViewState.ERROR,
    },
};
