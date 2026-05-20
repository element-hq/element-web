/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { E2ePadlock, E2ePadlockIcon } from "./E2ePadlock";

const meta = {
    title: "Timeline/Timeline Event/E2ePadlock",
    component: E2ePadlock,
    tags: ["autodocs"],
    argTypes: {
        icon: {
            options: Object.values(E2ePadlockIcon),
            control: { type: "select" },
        },
    },
    args: {
        icon: E2ePadlockIcon.Normal,
        title: "The authenticity of this message could not be guaranteed",
        className: "",
    },
} satisfies Meta<typeof E2ePadlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

export const Warning: Story = {
    args: {
        icon: E2ePadlockIcon.Warning,
        title: "This message was sent unencrypted",
    },
};

export const DecryptionFailure: Story = {
    args: {
        icon: E2ePadlockIcon.DecryptionFailure,
        title: "Unable to decrypt message",
    },
};
