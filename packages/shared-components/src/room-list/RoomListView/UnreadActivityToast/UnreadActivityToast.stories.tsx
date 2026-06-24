/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { UnreadActivityToast } from "./UnreadActivityToast";

const meta = {
    title: "Room List/UnreadActivityToast",
    component: UnreadActivityToast,
    tags: ["autodocs"],
    args: {
        onClick: fn(),
    },
    decorators: [
        (Story) => (
            <div style={{ position: "relative", width: "320px", height: "100px", backgroundColor: "grey" }}>
                <Story />
            </div>
        ),
    ],
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/qurBlLqjf3mRNpyZ1ffamm/ER-213---Sections?node-id=461-23295",
        },
    },
} satisfies Meta<typeof UnreadActivityToast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
