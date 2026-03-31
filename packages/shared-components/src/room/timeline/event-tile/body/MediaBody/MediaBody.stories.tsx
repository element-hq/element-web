/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { MediaBody } from "./MediaBody";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
    title: "MessageBody/MediaBody",
    component: MediaBody,
    tags: ["autodocs"],
    args: {
        children: "Media content goes here",
    },
} satisfies Meta<typeof MediaBody>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
