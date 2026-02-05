/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Room } from "../RoomListItem/RoomListItem";
import type { FilterId } from "../RoomListPrimaryFilters";
import { RoomListView, type RoomListSnapshot, type RoomListViewActions } from "./RoomListView";
import { useMockedViewModel } from "../../viewmodel";
import {
    renderAvatar,
    createGetRoomItemViewModel,
    mockRoomIds,
    smallListRoomIds,
    largeListRoomIds,
} from "../story-mocks";

type RoomListViewProps = RoomListSnapshot & RoomListViewActions & { renderAvatar: (room: Room) => React.ReactElement };

const mockFilterIds: FilterId[] = ["unread", "people", "rooms", "favourite"];

// Wrapper component that creates a mocked ViewModel
const RoomListViewWrapper = ({
    onToggleFilter,
    createChatRoom,
    createRoom,
    getRoomItemViewModel,
    updateVisibleRooms,
    renderAvatar: renderAvatarProp,
    ...rest
}: RoomListViewProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onToggleFilter,
        createChatRoom,
        createRoom,
        getRoomItemViewModel,
        updateVisibleRooms,
    });
    return <RoomListView vm={vm} renderAvatar={renderAvatarProp} />;
};

const meta = {
    title: "Room List/RoomListView",
    component: RoomListViewWrapper,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div
                style={{
                    width: "320px",
                    height: "600px",
                    border: "1px solid var(--cpd-color-border-interactive-primary)",
                    display: "flex",
                    flexDirection: "column",
                    resize: "horizontal",
                    overflow: "auto",
                    minWidth: "250px",
                    maxWidth: "800px",
                }}
            >
                <Story />
            </div>
        ),
    ],
    args: {
        // Snapshot properties (state)
        isLoadingRooms: false,
        isRoomListEmpty: false,
        filterIds: mockFilterIds,
        activeFilterId: undefined,
        roomListState: {
            activeRoomIndex: undefined,
            spaceId: "!space:server",
            filterKeys: undefined,
        },
        roomIds: mockRoomIds,
        canCreateRoom: true,
        // Action properties (callbacks)
        onToggleFilter: fn(),
        createChatRoom: fn(),
        createRoom: fn(),
        getRoomItemViewModel: createGetRoomItemViewModel(mockRoomIds),
        updateVisibleRooms: fn(),
        renderAvatar,
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/vlmt46QDdE4dgXDiyBJXqp/ER-33-Left-Panel?node-id=2925-19126",
        },
    },
} satisfies Meta<typeof RoomListViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
    args: {
        isLoadingRooms: true,
    },
};

export const Empty: Story = {
    args: {
        isRoomListEmpty: true,
    },
};

export const EmptyWithoutCreatePermission: Story = {
    args: {
        isRoomListEmpty: true,
        canCreateRoom: false,
    },
};

export const WithActiveFilter: Story = {
    args: {
        filterIds: ["unread", "people", "rooms", "favourite"],
        activeFilterId: "favourite",
        roomListState: {
            activeRoomIndex: undefined,
            spaceId: "!space:server",
            filterKeys: ["favourites"],
        },
    },
};

export const WithSelection: Story = {
    args: {
        roomListState: {
            activeRoomIndex: 0,
            spaceId: "!space:server",
            filterKeys: undefined,
        },
    },
};

export const EmptyFavouriteFilter: Story = {
    args: {
        isRoomListEmpty: true,
        roomIds: [],
        filterIds: ["favourite", "people"],
        activeFilterId: "favourite",
    },
};

export const EmptyPeopleFilter: Story = {
    args: {
        isRoomListEmpty: true,
        roomIds: [],
        filterIds: ["people", "rooms"],
        activeFilterId: "people",
    },
};

export const EmptyRoomsFilter: Story = {
    args: {
        isRoomListEmpty: true,
        roomIds: [],
        filterIds: ["rooms", "people"],
        activeFilterId: "rooms",
    },
};

export const EmptyUnreadFilter: Story = {
    args: {
        isRoomListEmpty: true,
        roomIds: [],
        filterIds: ["unread", "people"],
        activeFilterId: "unread",
    },
};

export const EmptyInvitesFilter: Story = {
    args: {
        isRoomListEmpty: true,
        roomIds: [],
        filterIds: ["invites", "people"],
        activeFilterId: "invites",
    },
};

export const EmptyMentionsFilter: Story = {
    args: {
        isRoomListEmpty: true,
        roomIds: [],
        filterIds: ["mentions", "people"],
        activeFilterId: "mentions",
    },
};

export const EmptyLowPriorityFilter: Story = {
    args: {
        isRoomListEmpty: true,
        roomIds: [],
        filterIds: ["low_priority", "people"],
        activeFilterId: "low_priority",
    },
};

export const SmallList: Story = {
    args: {
        roomIds: smallListRoomIds,
        getRoomItemViewModel: createGetRoomItemViewModel(smallListRoomIds),
    },
};

export const LargeList: Story = {
    args: {
        roomIds: largeListRoomIds,
        getRoomItemViewModel: createGetRoomItemViewModel(largeListRoomIds),
    },
};
