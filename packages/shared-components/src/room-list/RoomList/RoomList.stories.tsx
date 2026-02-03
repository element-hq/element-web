/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomList, type RoomListViewState } from "./RoomList";
import type { RoomListSnapshot, RoomListViewActions } from "../RoomListView";
import { useMockedViewModel } from "../../viewmodel";
import type { FilterId } from "../RoomListPrimaryFilters";
import { renderAvatar, createGetRoomItemViewModel, mockRoomIds } from "../story-mocks";

type RoomListStoryProps = RoomListSnapshot & RoomListViewActions & { renderAvatar: (room: any) => React.ReactElement };

// Use first 10 room IDs for this story
const storyRoomIds = mockRoomIds.slice(0, 10);

// Wrapper component that creates a mocked ViewModel
const RoomListWrapper = ({
    onToggleFilter,
    createChatRoom,
    createRoom,
    getRoomItemViewModel,
    updateVisibleRooms,
    renderAvatar: renderAvatarProp,
    ...rest
}: RoomListStoryProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onToggleFilter,
        createChatRoom,
        createRoom,
        getRoomItemViewModel,
        updateVisibleRooms,
    });

    return (
        <div style={{ height: "400px", border: "1px solid #ccc" }}>
            <RoomList vm={vm} renderAvatar={renderAvatarProp} />
        </div>
    );
};

const mockFilterIds: FilterId[] = ["unread", "people"];

const defaultRoomListState: RoomListViewState = {
    activeRoomIndex: 0,
    spaceId: "!space:server",
    filterKeys: undefined,
};

const meta: Meta<RoomListStoryProps> = {
    title: "Room List/RoomList",
    component: RoomListWrapper,
    tags: ["autodocs"],
    args: {
        isLoadingRooms: false,
        isRoomListEmpty: false,
        filterIds: mockFilterIds,
        activeFilterId: undefined,
        roomIds: storyRoomIds,
        roomListState: defaultRoomListState,
        canCreateRoom: true,
        onToggleFilter: fn(),
        createChatRoom: fn(),
        createRoom: fn(),
        getRoomItemViewModel: createGetRoomItemViewModel(storyRoomIds),
        updateVisibleRooms: fn(),
        renderAvatar,
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
};

export default meta;
type Story = StoryObj<RoomListStoryProps>;

export const Default: Story = {};
