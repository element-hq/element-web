/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Meta, type StoryObj } from "@storybook/react-vite";
import React from "react";
import { fn } from "storybook/test";
import { CheckIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { GenericToast } from "./GenericToast";

const meta = {
    title: "Core/GenericToast",
    component: GenericToast,
    tags: ["autodocs"],
    args: {
        description: "You have unverified sessions.",
        primaryLabel: "Accept",
        onPrimaryClick: fn(),
        secondaryLabel: "Reject",
        onSecondaryClick: fn(),
    },
} satisfies Meta<typeof GenericToast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDetail: Story = {
    args: {
        detail: "Some more detail about the toast.",
    },
};

export const PrimaryOnly: Story = {
    args: {
        secondaryLabel: undefined,
        onSecondaryClick: undefined,
    },
};

export const Destructive: Story = {
    args: {
        destructive: "secondary",
    },
};

export const WithIcons: Story = {
    args: {
        PrimaryIcon: CheckIcon,
    },
};

export const WithLink: Story = {
    args: {
        description: (
            <span>
                Soon, unverified devices will not be able to send and receive messages.{" "}
                <a href="https://example.org">Learn more</a>
            </span>
        ),
    },
};
