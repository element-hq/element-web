/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { AudioPlayerView, type AudioPlayerViewActions, type AudioPlayerViewSnapshot } from "./AudioPlayerView";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";

type AudioPlayerProps = AudioPlayerViewSnapshot & AudioPlayerViewActions;
const AudioPlayerViewWrapperImpl = ({
    togglePlay,
    onKeyDown,
    onSeekbarChange,
    ...rest
}: AudioPlayerProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        togglePlay,
        onKeyDown,
        onSeekbarChange,
    });
    return <AudioPlayerView vm={vm} />;
};
const AudioPlayerViewWrapper = withViewDocs(AudioPlayerViewWrapperImpl, AudioPlayerView);

const meta = {
    title: "Room/Timeline/EventTile/Body/AudioPlayerView",
    component: AudioPlayerViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        playbackState: {
            options: ["stopped", "playing", "paused", "decoding"],
            control: { type: "select" },
        },
    },
    args: {
        mediaName: "Sample Audio",
        durationSeconds: 300,
        playedSeconds: 120,
        percentComplete: 30,
        playbackState: "stopped",
        sizeBytes: 3500,
        error: false,
        togglePlay: fn(),
        onKeyDown: fn(),
        onSeekbarChange: fn(),
    },
} satisfies Meta<typeof AudioPlayerViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoMediaName: Story = {
    args: {
        mediaName: undefined,
    },
};

export const NoSize: Story = {
    args: {
        sizeBytes: undefined,
    },
};

export const HasError: Story = {
    args: {
        error: true,
    },
};
