/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { LinkedText } from "./LinkedText";
import { LinkedTextContext } from "./LinkedTextContext";

const meta = {
    title: "Utils/LinkedText",
    component: LinkedText,
    decorators: [
        (Story) => (
            <LinkedTextContext.Provider value={args}>
                <Story />
            </LinkedTextContext.Provider>
        ),
    ],
    args: {
        children: "I love working on https://matrix.org.",
    },
    tags: ["autodocs"],
} satisfies Meta<ComponentProps<typeof LinkedText> & ComponentProps<typeof LinkedTextContext>["value"]>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithUserId: Story = {
    args: {
        children: "I love talking to @alice:example.org.",
        userIdListener: fn(),
    },
};

export const WithRoomAlias: Story = {
    args: {
        children: "I love talking in #general:example.org.",
        roomAliasListener: fn(),
    },
};

export const WithCustomUrlTarget: Story = {
    args: {
        urlTargetTransformer: () => "_fake_target",
    },
    tags: ["skip-test"],
};

export const WithCustomHref: Story = {
    args: {
        hrefTransformer: () => {
            return "https://example.org";
        },
    },
    tags: ["skip-test"],
};
