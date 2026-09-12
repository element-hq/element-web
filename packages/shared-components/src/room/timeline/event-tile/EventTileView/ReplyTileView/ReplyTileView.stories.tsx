/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { type MemberAvatarViewSnapshot } from "../../../../../core/MemberAvatar/MemberAvatarView";
import { useMockedViewModel } from "../../../../../core/viewmodel";
import { withViewDocs } from "../../../../../../.storybook/withViewDocs";
import { type DisambiguatedProfileViewSnapshot } from "../DisambiguatedProfile";
import { ReplyTileView, type ReplyTileViewActions, type ReplyTileViewSnapshot } from "./ReplyTileView";

interface ReplyTileStoryProps extends Omit<ReplyTileViewSnapshot, "sender">, ReplyTileViewActions {
    senderName?: string;
    showAvatar?: boolean;
    showProfile?: boolean;
}

const ReplyTileViewWrapperImpl = ({
    senderName,
    showAvatar = true,
    showProfile = true,
    onClick,
    ...snapshot
}: ReplyTileStoryProps): JSX.Element => {
    const avatarViewModel = useMockedViewModel<MemberAvatarViewSnapshot, Record<string, never>>(
        {
            id: "@alice:example.org",
            name: senderName ?? "Alice",
            size: "16px",
        },
        {},
    );
    const profileViewModel = useMockedViewModel<DisambiguatedProfileViewSnapshot, Record<string, never>>(
        {
            displayName: senderName ?? "Alice",
            emphasizeDisplayName: true,
        },
        {},
    );
    const vm = useMockedViewModel<ReplyTileViewSnapshot, ReplyTileViewActions>(
        {
            ...snapshot,
            sender: senderName
                ? {
                      avatarViewModel: showAvatar ? avatarViewModel : undefined,
                      profileViewModel: showProfile ? profileViewModel : undefined,
                  }
                : undefined,
        },
        { onClick },
    );

    return <ReplyTileView vm={vm} />;
};

const ReplyTileViewWrapper = withViewDocs(ReplyTileViewWrapperImpl, ReplyTileView);

const body = (
    <p>
        This is a reply preview shown inside the timeline, rendered without depending on legacy ReplyTile class names.
    </p>
);

const meta = {
    title: "Timeline/EventTile/ReplyTileView",
    component: ReplyTileViewWrapper,
    tags: ["autodocs"],
    args: {
        href: "#/room/!example:example.org/$event",
        onClick: fn(),
        senderName: "Alice",
        showAvatar: true,
        showProfile: true,
        body,
    },
} satisfies Meta<typeof ReplyTileViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Inline: Story = {
    args: {
        inline: true,
        showProfile: false,
        body: "Alice waves hello",
    },
};

export const Informational: Story = {
    args: {
        info: true,
        senderName: undefined,
        body: "Alice joined the room",
    },
};

export const WithoutSender: Story = {
    args: {
        senderName: undefined,
        body: "A reply without sender presentation",
    },
};

export const LongEditedReply: Story = {
    decorators: [
        (Story) => (
            <div style={{ width: 320 }}>
                <Story />
            </div>
        ),
    ],
    args: {
        body: (
            <span data-textual-body-annotation-wrapper>
                <span>
                    This deliberately long edited reply demonstrates that textual content is constrained to two lines
                    instead of overflowing the compact reply preview.
                </span>
                <span data-textual-body-edited-marker>Edited</span>
            </span>
        ),
    },
};
