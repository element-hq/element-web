/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomListHeader, type RoomListHeaderSnapshot } from "./RoomListHeader";
import { SortOption, type SortOptionsMenuSnapshot } from "./SortOptionsMenu";
import type { SpaceMenuSnapshot } from "./SpaceMenu";
import type { ComposeMenuSnapshot } from "./ComposeMenu";
import { type ViewModel } from "../../viewmodel/ViewModel";

const meta: Meta<typeof RoomListHeader> = {
    title: "Room List/RoomListHeader",
    component: RoomListHeader,
    tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RoomListHeader>;

function createMockViewModel<T>(snapshot: T): ViewModel<T> {
    return {
        getSnapshot: () => snapshot,
        subscribe: () => () => {},
    };
}

const baseSortOptionsViewModel = createMockViewModel<SortOptionsMenuSnapshot>({
    activeSortOption: SortOption.Activity,
    sort: (option: SortOption) => console.log("Sort by:", option),
});

export const Default: Story = {
    args: {
        vm: createMockViewModel<RoomListHeaderSnapshot>({
            title: "Home",
            isSpace: false,
            displayComposeMenu: false,
            onComposeClick: () => console.log("Compose clicked"),
            sortOptionsMenuVm: baseSortOptionsViewModel,
        }),
    },
};

export const WithSpaceMenu: Story = {
    args: {
        vm: createMockViewModel<RoomListHeaderSnapshot>({
            title: "My Space",
            isSpace: true,
            displayComposeMenu: false,
            spaceMenuVm: createMockViewModel<SpaceMenuSnapshot>({
                title: "My Space",
                canInviteInSpace: true,
                canAccessSpaceSettings: true,
                openSpaceHome: () => console.log("Open space home"),
                inviteInSpace: () => console.log("Invite in space"),
                openSpacePreferences: () => console.log("Open space preferences"),
                openSpaceSettings: () => console.log("Open space settings"),
            }),
            onComposeClick: () => console.log("Compose clicked"),
            sortOptionsMenuVm: baseSortOptionsViewModel,
        }),
    },
};

export const WithComposeMenu: Story = {
    args: {
        vm: createMockViewModel<RoomListHeaderSnapshot>({
            title: "Home",
            isSpace: false,
            displayComposeMenu: true,
            composeMenuVm: createMockViewModel<ComposeMenuSnapshot>({
                canCreateRoom: true,
                canCreateVideoRoom: true,
                createChatRoom: () => console.log("Create chat room"),
                createRoom: () => console.log("Create room"),
                createVideoRoom: () => console.log("Create video room"),
            }),
            sortOptionsMenuVm: baseSortOptionsViewModel,
        }),
    },
};

export const FullHeader: Story = {
    args: {
        vm: createMockViewModel<RoomListHeaderSnapshot>({
            title: "My Space",
            isSpace: true,
            displayComposeMenu: true,
            spaceMenuVm: createMockViewModel<SpaceMenuSnapshot>({
                title: "My Space",
                canInviteInSpace: true,
                canAccessSpaceSettings: true,
                openSpaceHome: () => console.log("Open space home"),
                inviteInSpace: () => console.log("Invite in space"),
                openSpacePreferences: () => console.log("Open space preferences"),
                openSpaceSettings: () => console.log("Open space settings"),
            }),
            composeMenuVm: createMockViewModel<ComposeMenuSnapshot>({
                canCreateRoom: true,
                canCreateVideoRoom: true,
                createChatRoom: () => console.log("Create chat room"),
                createRoom: () => console.log("Create room"),
                createVideoRoom: () => console.log("Create video room"),
            }),
            sortOptionsMenuVm: baseSortOptionsViewModel,
        }),
    },
};

export const LongTitle: Story = {
    args: {
        vm: createMockViewModel<RoomListHeaderSnapshot>({
            title: "This is a very long space name that should be truncated with ellipsis when it overflows",
            isSpace: true,
            displayComposeMenu: true,
            spaceMenuVm: createMockViewModel<SpaceMenuSnapshot>({
                title: "This is a very long space name that should be truncated with ellipsis when it overflows",
                canInviteInSpace: true,
                canAccessSpaceSettings: true,
                openSpaceHome: () => console.log("Open space home"),
                inviteInSpace: () => console.log("Invite in space"),
                openSpacePreferences: () => console.log("Open space preferences"),
                openSpaceSettings: () => console.log("Open space settings"),
            }),
            composeMenuVm: createMockViewModel<ComposeMenuSnapshot>({
                canCreateRoom: true,
                canCreateVideoRoom: true,
                createChatRoom: () => console.log("Create chat room"),
                createRoom: () => console.log("Create room"),
                createVideoRoom: () => console.log("Create video room"),
            }),
            sortOptionsMenuVm: baseSortOptionsViewModel,
        }),
    },
    decorators: [
        (Story) => (
            <div style={{ width: "320px" }}>
                <Story />
            </div>
        ),
    ],
};
