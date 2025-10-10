/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import {
    RoomPickerView,
    type RoomPickerViewActions,
    type RoomPickerViewModel,
    type RoomPickerViewSnapshot,
} from "./RoomPickerView";
import { ViewWrapper } from "../../ViewWrapper";

type RoomPickerProps = RoomPickerViewSnapshot<any> & RoomPickerViewActions;
const RoomPickerViewWrapper = (props: RoomPickerProps): JSX.Element => (
    <ViewWrapper<RoomPickerViewSnapshot<any>, RoomPickerViewModel<any>>
        // @ts-ignore
        Component={RoomPickerView}
        props={props}
        componentProps={{
            renderRoomAvatar: (room: any, size: string) => (
                <div style={{ width: size, height: size, backgroundColor: "#ccc", borderRadius: "50%" }} />
            ),
        }}
    />
);

export default {
    title: "multiroom/RoomPickerView",
    component: RoomPickerViewWrapper,
    decorators: [
        (Story) => (
            <div style={{ width: "520px" }}>
                <Story />
            </div>
        ),
    ],
    beforeEach: () => {
        Date.now = () => new Date("2025-08-01T12:00:00Z").getTime();
    },
    args: {
        rooms: [
            {
                id: "!room1:matrix.org",
                name: "Room 1",
                description: "#room1:matrix.org",
                timestamp: Date.now() - 60000,
                selected: false,
            },
            {
                id: "!room2:matrix.org",
                name: "Room 2",
                description: "#room2:matrix.org",
                timestamp: Date.now() - 60000,
                selected: false,
            },
            {
                id: "!room3:matrix.org",
                name: "Room 3",
                description: "#room3:matrix.org",
                timestamp: Date.now() - 60000,
                selected: false,
            },
        ],
        selectedRooms: [],
        toggleRoom: fn(),
        addRooms: fn(),
    },
    tags: ["autodocs"],
} as Meta<typeof RoomPickerViewWrapper>;

const Template: StoryFn<typeof RoomPickerViewWrapper> = (args) => <RoomPickerViewWrapper {...args} />;

export const Default = Template.bind({});

export const SelectedRooms = Template.bind({});
SelectedRooms.args = {
    selectedRooms: [
        {
            id: "!room2:matrix.org",
            name: "Room 2",
            description: "#room2:matrix.org",
            timestamp: Date.now() - 60000,
            selected: true,
        },
    ],
    rooms: [
        {
            id: "!room1:matrix.org",
            name: "Room 1",
            description: "#room1:matrix.org",
            timestamp: Date.now() - 60000,
            selected: false,
        },
        {
            id: "!room2:matrix.org",
            name: "Room 2",
            description: "#room2:matrix.org",
            timestamp: Date.now() - 60000,
            selected: true,
        },
        {
            id: "!room3:matrix.org",
            name: "Room 3",
            description: "#room3:matrix.org",
            timestamp: Date.now() - 60000,
            selected: false,
        },
    ],
};
