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
import type { RoomListViewModel, RoomListSnapshot } from "../RoomListView";
import type { RoomListHeaderState } from "./RoomListHeader";

const meta: Meta<typeof RoomListHeader> = {
    title: "Room List/RoomListHeader",
    component: RoomListHeader,
    tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RoomListHeader>;

const createMockViewModel = (headerState: RoomListHeaderState): RoomListViewModel => {
    const snapshot: RoomListSnapshot = {
        headerState,
        isLoadingRooms: false,
        isRoomListEmpty: false,
        filters: [],
        roomListState: {
            rooms: [],
        },
    };

    return {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => {
            return () => {};
        },
        sort: (option: SortOption) => console.log("Sort by:", option),
        onToggleFilter: () => {},
        onSearchClick: () => {},
        onDialPadClick: () => {},
        onExploreClick: () => {},
        showDialPad: false,
        showExplore: false,
        onComposeClick: () => console.log("Compose clicked"),
        openSpaceHome: () => console.log("Open space home"),
        inviteInSpace: () => console.log("Invite in space"),
        openSpacePreferences: () => console.log("Open space preferences"),
        openSpaceSettings: () => console.log("Open space settings"),
        createChatRoom: () => console.log("Create chat room"),
        createRoom: () => console.log("Create room"),
        createVideoRoom: () => console.log("Create video room"),
        onOpenRoom: () => {},
        onMarkAsRead: () => {},
        onMarkAsUnread: () => {},
        onToggleFavorite: () => {},
        onToggleLowPriority: () => {},
        onInvite: () => {},
        onCopyRoomLink: () => {},
        onLeaveRoom: () => {},
        onSetRoomNotifState: () => {},
    };
};

export const Default: Story = {
    args: {
        vm: createMockViewModel({
            title: "Home",
            isSpace: false,
            displayComposeMenu: false,
            activeSortOption: SortOption.Activity,
        }),
    },
};

export const WithSpaceMenu: Story = {
    args: {
        vm: createMockViewModel({
            title: "My Space",
            isSpace: true,
            spaceMenuState: {
                title: "My Space",
                canInviteInSpace: true,
                canAccessSpaceSettings: true,
            },
            displayComposeMenu: false,
            activeSortOption: SortOption.Activity,
        }),
    },
};

export const WithComposeMenu: Story = {
    args: {
        vm: createMockViewModel({
            title: "Home",
            isSpace: false,
            displayComposeMenu: true,
            composeMenuState: {
                canCreateRoom: true,
                canCreateVideoRoom: true,
            },
            activeSortOption: SortOption.Activity,
        }),
    },
};

export const FullHeader: Story = {
    args: {
        vm: createMockViewModel({
            title: "My Space",
            isSpace: true,
            spaceMenuState: {
                title: "My Space",
                canInviteInSpace: true,
                canAccessSpaceSettings: true,
            },
            displayComposeMenu: true,
            composeMenuState: {
                canCreateRoom: true,
                canCreateVideoRoom: true,
            },
            activeSortOption: SortOption.Activity,
        }),
    },
};

export const LongTitle: Story = {
    args: {
        vm: createMockViewModel({
            title: "This is a very long space name that should be truncated with ellipsis when it overflows",
            isSpace: true,
            spaceMenuState: {
                title: "This is a very long space name that should be truncated with ellipsis when it overflows",
                canInviteInSpace: true,
                canAccessSpaceSettings: true,
            },
            displayComposeMenu: true,
            composeMenuState: {
                canCreateRoom: true,
                canCreateVideoRoom: true,
            },
            activeSortOption: SortOption.Activity,
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
