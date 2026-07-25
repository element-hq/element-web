/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { type MemberAvatarViewSnapshot, MemberAvatarView } from "./MemberAvatarView";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import profile from "../../../static/profile-pics/profile3.png";
import { useMockedViewModel } from "../viewmodel";

const MemberAvatarViewWrapperImpl = (snapshot: MemberAvatarViewSnapshot): React.ReactNode => {
    const vm = useMockedViewModel(snapshot, {});
    return <MemberAvatarView vm={vm} />;
};

const MemberAvatarViewWrapper = withViewDocs(MemberAvatarViewWrapperImpl, MemberAvatarView);

const meta = {
    title: "Core/MemberAvatarView",
    component: MemberAvatarViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        url: {
            control: "text",
        },
    },
    args: {
        id: "@bob:m.org",
        name: "Bob",
        size: "20px",
        title: "@bob:m.org",
        url: profile,
    },
} satisfies Meta<typeof MemberAvatarViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
