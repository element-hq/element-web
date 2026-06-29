/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { FilterId } from "../RoomListPrimaryFilters";
import { RoomListView, type RoomListViewSnapshot, type RoomListViewActions } from "./RoomListView";
import type { Room } from "../VirtualizedRoomListView/RoomListItemWrapper/RoomListItemView";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import {
    renderAvatar,
    createGetRoomItemViewModel,
    mockRoomIds,
    mockSections,
    createGetSectionHeaderViewModel,
    mockSmallListSections,
    mockLargeListSections,
    mockLargeListRoomIds,
} from "../story-mocks";

type RoomListViewProps = RoomListViewSnapshot &
    RoomListViewActions & { renderAvatar: (room: Room) => React.ReactElement };

const mockFilterIds: FilterId[] = ["unread", "people", "rooms"];

// Wrapper component that creates a mocked ViewModel
const RoomListViewWrapperImpl = ({
    onToggleFilter,
    createChatRoom,
    createRoom,
    getRoomItemViewModel,
    getSectionHeaderViewModel,
    updateVisibleRooms,
    updateVisibleFold,
    renderAvatar: renderAvatarProp,
    closeToast,
    scrollToUnreadActivity,
    setScrollToIndex,
    changeRoomSection,
    changeSectionOrder,
    onSectionDragStart,
    onSectionDragEnd,
    ...rest
}: RoomListViewProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onToggleFilter,
        createChatRoom,
        createRoom,
        getRoomItemViewModel,
        getSectionHeaderViewModel,
        updateVisibleRooms,
        updateVisibleFold,
        closeToast,
        scrollToUnreadActivity,
        setScrollToIndex,
        changeRoomSection,
        changeSectionOrder,
        onSectionDragStart,
        onSectionDragEnd,
    });
    return <RoomListView vm={vm} renderAvatar={renderAvatarProp} />;
};
const RoomListViewWrapper = withViewDocs(RoomListViewWrapperImpl, RoomListView);

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
        sections: mockSections,
        canCreateRoom: true,
        // Action properties (callbacks)
        onToggleFilter: fn(),
        createChatRoom: fn(),
        createRoom: fn(),
        getRoomItemViewModel: createGetRoomItemViewModel(mockRoomIds),
        getSectionHeaderViewModel: createGetSectionHeaderViewModel(mockSections.map((section) => section.id)),
        updateVisibleRooms: fn(),
        updateVisibleFold: fn(),
        renderAvatar,
        isFlatList: true,
        toast: undefined,
        closeToast: fn(),
        scrollToUnreadActivity: fn(),
        setScrollToIndex: fn(),
        changeRoomSection: fn(),
        changeSectionOrder: fn(),
        onSectionDragStart: fn(),
        onSectionDragEnd: fn(),
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

export const Section: Story = {
    args: {
        isFlatList: false,
    },
};

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
        filterIds: ["unread", "people", "rooms"],
        activeFilterId: "people",
        roomListState: {
            activeRoomIndex: undefined,
            spaceId: "!space:server",
            filterKeys: ["people"],
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

export const EmptyPeopleFilter: Story = {
    args: {
        isRoomListEmpty: true,
        filterIds: ["people", "rooms"],
        activeFilterId: "people",
    },
};

export const EmptyRoomsFilter: Story = {
    args: {
        isRoomListEmpty: true,
        filterIds: ["rooms", "people"],
        activeFilterId: "rooms",
    },
};

export const EmptyUnreadFilter: Story = {
    args: {
        isRoomListEmpty: true,
        filterIds: ["unread", "people"],
        activeFilterId: "unread",
    },
};

export const EmptyInvitesFilter: Story = {
    args: {
        isRoomListEmpty: true,
        filterIds: ["invites", "people"],
        activeFilterId: "invites",
    },
};

export const EmptyMentionsFilter: Story = {
    args: {
        isRoomListEmpty: true,

        filterIds: ["mentions", "people"],
        activeFilterId: "mentions",
    },
};

export const SmallFlatList: Story = {
    args: {
        sections: mockSmallListSections,
    },
};

export const LargeFlatList: Story = {
    args: {
        sections: mockLargeListSections,
        getRoomItemViewModel: createGetRoomItemViewModel(mockLargeListRoomIds),
        getSectionHeaderViewModel: createGetSectionHeaderViewModel(mockLargeListSections.map((section) => section.id)),
    },
};

export const SmallSectionList: Story = {
    args: {
        isFlatList: false,
        sections: mockSmallListSections,
    },
};

export const LargeSectionList: Story = {
    args: {
        isFlatList: false,
        sections: mockLargeListSections,
        getRoomItemViewModel: createGetRoomItemViewModel(mockLargeListRoomIds),
        getSectionHeaderViewModel: createGetSectionHeaderViewModel(mockLargeListSections.map((section) => section.id)),
    },
};

export const Toast: Story = {
    args: {
        toast: "section_created",
    },
};

export const UnreadActivityBelow: Story = {
    args: {
        toast: "unread_activity",
    },
};
