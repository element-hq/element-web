/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";
import { type Meta, type StoryObj } from "@storybook/react-vite";
import { Button } from "@vector-im/compound-web";

import { Banner } from "./Banner";

const meta = {
    title: "room/Banner",
    component: Banner,
    tags: ["autodocs"],
    args: {
        children: <p>Hello! This is a status banner.</p>,
        onClose: fn(),
    },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Info: Story = {
    args: {
        type: "info",
    },
};
export const Success: Story = {
    args: {
        type: "success",
    },
};
export const Critical: Story = {
    args: {
        type: "critical",
    },
};
export const WithAction: Story = {
    args: {
        children: (
            <p>
                Alice's (<b>@alice:example.com</b>) identity was reset. <a href="https://example.org">Learn more</a>
            </p>
        ),
        actions: (
            <Button kind="primary" size="sm">
                Withdraw verification
            </Button>
        ),
    },
};

export const WithAvatarImage: Story = {
    args: {
        avatar: <img alt="Example" src="https://picsum.photos/32/32" />,
    },
};

export const WithoutClose: Story = {
    args: {
        onClose: undefined,
    },
};

export const WithLoadsOfContent: Story = {
    args: {
        type: "info",
        children: (
            <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed quis massa facilisis, venenatis risus
                consectetur, sagittis libero. Aenean et scelerisque justo. Nunc luctus, mi sed facilisis suscipit, magna
                ante pharetra sem, eu rutrum purus quam quis arcu. Sed eleifend arcu vitae magna sodales, sit amet
                fermentum urna dictum. Mauris vel velit pulvinar enim mollis tincidunt. Vivamus egestas rhoncus
                sagittis. Curabitur auctor vehicula massa, et cursus lacus laoreet a. Maecenas et sollicitudin lectus,
                in ligula.
            </p>
        ),
    },
};
