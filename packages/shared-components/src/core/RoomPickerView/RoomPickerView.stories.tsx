/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    RoomPickerView,
    type RoomOfRoomPickerView,
    type RoomPickerViewSnapshot,
    type RoomPickerViewActions,
} from "./RoomPickerView";
import { useMockedViewModel } from "../viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type RoomPickerProps = RoomPickerViewSnapshot & RoomPickerViewActions;

const RoomPickerViewWrapperImpl = ({
    toggleRoom,
    search,
    unSelectLastRoom,
    renderRoomAvatar,
    ...rest
}: RoomPickerProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        toggleRoom,
        search,
        unSelectLastRoom,
        renderRoomAvatar,
    });
    return <RoomPickerView vm={vm} />;
};
const RoomPickerViewWrapper = withViewDocs(RoomPickerViewWrapperImpl, RoomPickerView);

const currentTimestamp = new Date("2025-03-09T12:00:00Z").getTime();

const rooms: RoomOfRoomPickerView[] = [
    {
        id: "!room1:matrix.org",
        name: "Room 1",
        description: "#room1:matrix.org",
        timestamp: currentTimestamp,
        selected: false,
    },
    {
        id: "!room2:matrix.org",
        name: "Room 2",
        description: "#room2:matrix.org",
        timestamp: currentTimestamp,
        selected: true,
    },
    {
        id: "!room3:matrix.org",
        name: "Room 3",
        description: "#room3:matrix.org",
        timestamp: currentTimestamp,
        selected: false,
    },
];

const meta = {
    title: "Core/RoomPickerView",
    component: RoomPickerViewWrapper,
    tags: ["autodocs"],
    args: {
        rooms,
        selectedRooms: rooms.filter((room) => room.selected),
        placeholder: "Search rooms",
        listTitle: "Rooms",
        emptyListText: "No rooms found",
        toggleRoom: fn(),
        search: fn(),
        unSelectLastRoom: fn(),
        renderRoomAvatar: (room: RoomOfRoomPickerView, size: string): JSX.Element => (
            <div style={{ width: size, height: size, backgroundColor: "#ccc", borderRadius: "50%" }} />
        ),
    },
    beforeEach: () => {
        Date.now = () => new Date("2025-08-01T12:00:00Z").getTime();
    },
} satisfies Meta<typeof RoomPickerViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The list of rooms with one of them already selected, shown both as a checked
 * item in the list and as a pill in the input.
 */
export const Default: Story = {};

/**
 * Nothing selected yet: the input only shows its placeholder.
 */
export const NoSelection: Story = {
    args: {
        rooms: rooms.map((room) => ({ ...room, selected: false })),
        selectedRooms: [],
    },
};

/**
 * No room matches the search: the list is replaced by the empty state text.
 */
export const EmptyList: Story = {
    args: {
        rooms: [],
        selectedRooms: [],
    },
};
