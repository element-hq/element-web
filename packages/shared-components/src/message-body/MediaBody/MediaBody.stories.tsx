/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import { MediaBody } from "./MediaBody";
import type { Meta, StoryFn } from "@storybook/react-vite";

export default {
    title: "MessageBody/MediaBody",
    component: MediaBody,
    tags: ["autodocs"],
    args: {
        children: "Media content goes here",
    },
} as Meta<typeof MediaBody>;

const Template: StoryFn<typeof MediaBody> = (args) => <MediaBody {...args} />;

export const Default = Template.bind({});
