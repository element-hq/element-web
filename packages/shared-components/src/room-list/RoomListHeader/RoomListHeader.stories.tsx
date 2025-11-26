/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomListHeader } from "./RoomListHeader";
import { SortOption } from "./SortOptionsMenu";
import type { SpaceMenuViewModel } from "./SpaceMenu";
import type { ComposeMenuViewModel } from "./ComposeMenu";

const meta: Meta<typeof RoomListHeader> = {
    title: "Room List/RoomListHeader",
    component: RoomListHeader,
    tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RoomListHeader>;

const baseSortOptionsViewModel = {
    activeSortOption: SortOption.Activity,
    sort: (option: SortOption) => console.log("Sort by:", option),
};

export const Default: Story = {
    args: {
        viewModel: {
            title: "Home",
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: () => console.log("Compose clicked"),
            sortOptionsMenuViewModel: baseSortOptionsViewModel,
        },
    },
};

export const WithSpaceMenu: Story = {
    args: {
        viewModel: {
            title: "My Space",
            isSpace: true,
            spaceMenuViewModel: {
                title: "My Space",
                canInviteInSpace: true,
                canAccessSpaceSettings: true,
                openSpaceHome: () => console.log("Open space home"),
                inviteInSpace: () => console.log("Invite in space"),
                openSpacePreferences: () => console.log("Open space preferences"),
                openSpaceSettings: () => console.log("Open space settings"),
            } as SpaceMenuViewModel,
            displayComposeMenu: false,
            onComposeClick: () => console.log("Compose clicked"),
            sortOptionsMenuViewModel: baseSortOptionsViewModel,
        },
    },
};

export const WithComposeMenu: Story = {
    args: {
        viewModel: {
            title: "Home",
            isSpace: false,
            displayComposeMenu: true,
            composeMenuViewModel: {
                canCreateRoom: true,
                canCreateVideoRoom: true,
                createChatRoom: () => console.log("Create chat room"),
                createRoom: () => console.log("Create room"),
                createVideoRoom: () => console.log("Create video room"),
            } as ComposeMenuViewModel,
            sortOptionsMenuViewModel: baseSortOptionsViewModel,
        },
    },
};

export const FullHeader: Story = {
    args: {
        viewModel: {
            title: "My Space",
            isSpace: true,
            spaceMenuViewModel: {
                title: "My Space",
                canInviteInSpace: true,
                canAccessSpaceSettings: true,
                openSpaceHome: () => console.log("Open space home"),
                inviteInSpace: () => console.log("Invite in space"),
                openSpacePreferences: () => console.log("Open space preferences"),
                openSpaceSettings: () => console.log("Open space settings"),
            } as SpaceMenuViewModel,
            displayComposeMenu: true,
            composeMenuViewModel: {
                canCreateRoom: true,
                canCreateVideoRoom: true,
                createChatRoom: () => console.log("Create chat room"),
                createRoom: () => console.log("Create room"),
                createVideoRoom: () => console.log("Create video room"),
            } as ComposeMenuViewModel,
            sortOptionsMenuViewModel: baseSortOptionsViewModel,
        },
    },
};

export const LongTitle: Story = {
    args: {
        viewModel: {
            title: "This is a very long space name that should be truncated with ellipsis when it overflows",
            isSpace: true,
            spaceMenuViewModel: {
                title: "This is a very long space name that should be truncated with ellipsis when it overflows",
                canInviteInSpace: true,
                canAccessSpaceSettings: true,
                openSpaceHome: () => console.log("Open space home"),
                inviteInSpace: () => console.log("Invite in space"),
                openSpacePreferences: () => console.log("Open space preferences"),
                openSpaceSettings: () => console.log("Open space settings"),
            } as SpaceMenuViewModel,
            displayComposeMenu: true,
            composeMenuViewModel: {
                canCreateRoom: true,
                canCreateVideoRoom: true,
                createChatRoom: () => console.log("Create chat room"),
                createRoom: () => console.log("Create room"),
                createVideoRoom: () => console.log("Create video room"),
            } as ComposeMenuViewModel,
            sortOptionsMenuViewModel: baseSortOptionsViewModel,
        },
    },
    decorators: [
        (Story) => (
            <div style={{ width: "320px" }}>
                <Story />
            </div>
        ),
    ],
};
