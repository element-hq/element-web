/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { fn } from "storybook/test";

import { PlayPauseButton } from "./PlayPauseButton";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
    title: "Audio/PlayPauseButton",
    component: PlayPauseButton,
    tags: ["autodocs"],
    args: {
        togglePlay: fn(),
    },
} satisfies Meta<typeof PlayPauseButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Playing: Story = { args: { playing: true } };
