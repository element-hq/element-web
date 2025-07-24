/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import {
    AudioPlayer,
    type AudioPlayerActions,
    type AudioPlayerSnapshot,
    type AudioPlayerViewModel,
} from "./AudioPlayer";
import { ViewWrapper } from "../../ViewWrapper";

type AudioPlayerProps = AudioPlayerSnapshot & AudioPlayerActions;
const AudioPlayerWrapper = (props: AudioPlayerProps): JSX.Element => (
    <ViewWrapper<AudioPlayerSnapshot, AudioPlayerViewModel> Component={AudioPlayer} props={props} />
);

export default {
    title: "Audio/AudioPlayer",
    component: AudioPlayerWrapper,
    tags: ["autodocs"],
    argTypes: {
        playbackPhase: {
            options: ["stopped", "playing", "paused", "decoding"],
            control: { type: "select" },
        },
    },
    args: {
        mediaName: "Sample Audio",
        durationSeconds: 300,
        playedSeconds: 120,
        percentComplete: 30,
        playbackPhase: "stopped",
        sizeBytes: 3500,
        error: false,
        togglePlay: fn(),
        onKeyDown: fn(),
        onSeekbarChange: fn(),
    },
} as Meta<typeof AudioPlayerWrapper>;

const Template: StoryFn<typeof AudioPlayerWrapper> = (args) => <AudioPlayerWrapper {...args} />;

export const Default = Template.bind({});

export const NoMediaName = Template.bind({});
NoMediaName.args = {
    mediaName: undefined,
};

export const NoSize = Template.bind({});
NoSize.args = {
    sizeBytes: undefined,
};

export const HasError = Template.bind({});
HasError.args = {
    error: true,
};
