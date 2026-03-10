/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Room } from "../RoomListItemView";
import { VirtualizedRoomListView, type RoomListViewState } from "./VirtualizedRoomListView";
import type { RoomListSnapshot, RoomListViewActions } from "../RoomListView";
import { useMockedViewModel } from "../../viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import type { FilterId } from "../RoomListPrimaryFilters";
import {
    renderAvatar,
    createGetRoomItemViewModel,
    mock10RoomsIds,
    createGetSectionViewModel,
    mock10RoomsSections,
} from "../story-mocks";

type RoomListStoryProps = RoomListSnapshot & RoomListViewActions & { renderAvatar: (room: Room) => React.ReactElement };

// Wrapper component that creates a mocked ViewModel
const RoomListWrapperImpl = ({
    onToggleFilter,
    createChatRoom,
    createRoom,
    getRoomItemViewModel,
    getSectionViewModel,
    updateVisibleRooms,
    renderAvatar: renderAvatarProp,
    ...rest
}: RoomListStoryProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onToggleFilter,
        createChatRoom,
        createRoom,
        getRoomItemViewModel,
        getSectionViewModel,
        updateVisibleRooms,
    });

    return (
        <div style={{ height: "400px", border: "1px solid #ccc" }}>
            <VirtualizedRoomListView vm={vm} renderAvatar={renderAvatarProp} />
        </div>
    );
};
const RoomListWrapper = withViewDocs(RoomListWrapperImpl, VirtualizedRoomListView);

const mockFilterIds: FilterId[] = ["unread", "people"];

const defaultRoomListState: RoomListViewState = {
    activeRoomIndex: 0,
    spaceId: "!space:server",
    filterKeys: undefined,
};

const meta = {
    title: "Room List/VirtualizedRoomListView",
    component: RoomListWrapper,
    tags: ["autodocs"],
    args: {
        isLoadingRooms: false,
        isRoomListEmpty: false,
        filterIds: mockFilterIds,
        activeFilterId: undefined,
        sections: mock10RoomsSections,
        roomListState: defaultRoomListState,
        canCreateRoom: true,
        onToggleFilter: fn(),
        createChatRoom: fn(),
        createRoom: fn(),
        getRoomItemViewModel: createGetRoomItemViewModel(mock10RoomsIds),
        getSectionViewModel: createGetSectionViewModel(mock10RoomsSections.map((section) => section.id)),
        updateVisibleRooms: fn(),
        renderAvatar,
        isFlatList: true,
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/vlmt46QDdE4dgXDiyBJXqp/ER-33-Left-Panel-2025?node-id=98-1979&t=vafb4zoYMNLRuAbh-4",
        },
    },
    decorators: [
        (Story) => (
            <div style={{ width: "300px" }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof RoomListWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sections: Story = {
    args: {
        isFlatList: false,
    },
};
