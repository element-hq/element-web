/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { HiddenMediaPlaceholder } from "./HiddenMediaPlaceholder";

const HiddenMediaPlaceholderWrapper = withViewDocs(HiddenMediaPlaceholder, HiddenMediaPlaceholder);

const meta = {
    title: "Timeline/Timeline Body/HiddenMediaPlaceholder",
    component: HiddenMediaPlaceholderWrapper,
    tags: ["autodocs"],
    args: {
        children: "Show image",
        onClick: fn(),
        className: "",
    },
    decorators: [
        (Story) => (
            <div style={{ width: 320, height: 180 }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof HiddenMediaPlaceholderWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
