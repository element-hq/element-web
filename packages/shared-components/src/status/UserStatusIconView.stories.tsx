/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";

import { UserStatusIconView, type UserStatusIconViewModel } from "./UserStatusIconView";
import { MockViewModel } from "../core/viewmodel/MockViewModel";

const meta = {
    title: "Status/UserStatusIconView",
    component: UserStatusIconView,
    tags: ["autodocs"],
    args: {
        vm: new MockViewModel({ status: { emoji: "🐎", text: "on a horse" } }) as UserStatusIconViewModel,
    },
} satisfies Meta<typeof UserStatusIconView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoStatus: Story = {
    args: {
        vm: new MockViewModel({ status: undefined }) as UserStatusIconViewModel,
    },
};
