/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Meta, type StoryObj } from "@storybook/react-vite";
import React from "react";
import { MenuItem } from "@vector-im/compound-web";
import { fn } from "storybook/test";
import QrCodeIcon from "@vector-im/compound-design-tokens/assets/web/icons/qr-code";
import LockIcon from "@vector-im/compound-design-tokens/assets/web/icons/lock";
import ChatProblemIcon from "@vector-im/compound-design-tokens/assets/web/icons/chat-problem";
import SettingsIcon from "@vector-im/compound-design-tokens/assets/web/icons/settings";
import SignOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/sign-out";

import { QuickSettingsMenu } from "./QuickSettingsMenu";
import avatarUrl from "../../../static/element.png";

const meta = {
    title: "Menus/QuickSettingsMenu",
    component: QuickSettingsMenu,
    tags: ["autodocs"],
    args: {
        displayName: "string",
        userId: "string",
    },
} satisfies Meta<typeof QuickSettingsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        open: true,
        setOpen: fn(),
        avatarUrl,
        displayName: "Sally Sanderson",
        userId: "@person-name:homeserver.com",
        manageAccountHref: "#",
        expanded: true,
        children: (
            <>
                <MenuItem Icon={<QrCodeIcon />} label="Link new device" onSelect={fn()} />
                <MenuItem Icon={<LockIcon />} label="Security & Privacy" onSelect={fn()} />
                <MenuItem Icon={<ChatProblemIcon />} label="Feedback" onSelect={fn()} />
                <MenuItem Icon={<SettingsIcon />} label="All settings" onSelect={fn()} />
                <MenuItem Icon={<SignOutIcon />} kind="critical" label="Sign out" onSelect={fn()} />
            </>
        ),
    },
};
