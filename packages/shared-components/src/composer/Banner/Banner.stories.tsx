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
import { _t } from "../../utils/i18n";

const meta = {
    title: "room/Banner",
    component: Banner,
    tags: ["autodocs"],
    args: {
        children: <p>Hello! This is a status banner.</p>,
    },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        onClose: fn(),
    },
};
export const Info: Story = {
    args: {
        type: "info",
        onClose: fn(),
    },
};
export const Success: Story = {
    args: {
        type: "success",
        onClose: fn(),
    },
};
export const Critical: Story = {
    args: {
        type: "critical",
        onClose: fn(),
    },
};
export const WithAction: Story = {
    args: {
        children: (
            <p>
                {_t(
                    "encryption|pinned_identity_changed",
                    { displayName: "Alice", userId: "@alice:example.org" },
                    {
                        a: (sub) => <a href="https://example.org">{sub}</a>,
                        b: (sub) => <b>{sub}</b>,
                    },
                )}
            </p>
        ),
        actions: <Button kind="primary">{_t("encryption|withdraw_verification_action")}</Button>,
    },
};

export const WithAvatarImage: Story = {
    args: {
        avatar: <img alt="Example" src="https://picsum.photos/32/32" />,
        onClose: fn(),
    },
};

export const WithoutClose: Story = {};
