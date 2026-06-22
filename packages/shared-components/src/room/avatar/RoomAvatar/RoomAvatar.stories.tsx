/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../core/viewmodel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";
import { RoomAvatarView, type RoomAvatarViewActions, type RoomAvatarViewSnapshot } from "./RoomAvatarView";

type WrapperProps = RoomAvatarViewSnapshot & Partial<RoomAvatarViewActions> & { size: string; className?: string };

const RoomAvatarViewWrapperImpl = ({ onClick, size, className, ...snapshotProps }: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {
        onClick: onClick ?? fn(),
    });

    return <RoomAvatarView vm={vm} size={size} className={className} />;
};

const RoomAvatarViewWrapper = withViewDocs(RoomAvatarViewWrapperImpl, RoomAvatarView);

const meta = {
    title: "Room/RoomAvatar",
    component: RoomAvatarViewWrapper,
    tags: ["autodocs"],
    args: {
        size: "36px",
        name: "Test Room",
        idName: "!room:example.com",
        urls: [],
        type: "round",
        isClickable: false,
    },
} satisfies Meta<typeof RoomAvatarViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAvatar: Story = {
    args: {
        urls: ["https://example.com/avatar.png"],
    },
};

export const SpaceRoom: Story = {
    args: {
        type: "square",
        name: "My Space",
        idName: "!space:example.com",
    },
};

export const Clickable: Story = {
    args: {
        isClickable: true,
        urls: ["https://example.com/avatar.png"],
    },
};

export const LargeAvatar: Story = {
    args: {
        size: "80px",
        name: "Big Room",
        idName: "!bigroom:example.com",
    },
};
