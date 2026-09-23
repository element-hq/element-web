/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import {
    RoomAvatarEventView,
    type RoomAvatarEventViewActions,
    type RoomAvatarEventViewSnapshot,
} from "./RoomAvatarEventView";

type RoomAvatarEventViewStoryProps = RoomAvatarEventViewSnapshot &
    RoomAvatarEventViewActions & {
        className?: string;
    };

const RoomAvatarEventViewWrapperImpl = ({
    onAvatarClick,
    className,
    ...snapshot
}: RoomAvatarEventViewStoryProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, { onAvatarClick });

    return (
        <RoomAvatarEventView
            vm={vm}
            className={className}
            renderAvatar={() => (
                <span
                    aria-hidden="true"
                    style={{
                        display: "inline-block",
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "#0dbd8b",
                    }}
                />
            )}
        />
    );
};

const RoomAvatarEventViewWrapper = withViewDocs(RoomAvatarEventViewWrapperImpl, RoomAvatarEventView);

const meta = {
    title: "Timeline/Timeline Event/RoomAvatarEventView",
    component: RoomAvatarEventViewWrapper,
    tags: ["autodocs"],
    args: {
        senderDisplayName: "Alice",
        roomName: "General",
        avatarUrl: "mxc://example.org/avatar",
        lightboxLabel: "Alice changed the avatar for General",
        isRemoved: false,
        onAvatarClick: fn(),
        className: "",
    },
} satisfies Meta<typeof RoomAvatarEventViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Changed: Story = {};

export const Removed: Story = {
    args: {
        avatarUrl: undefined,
        isRemoved: true,
    },
};
