/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { SectionCreationView } from "./SectionCreationView";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import { type SectionCreationViewActions, type SectionCreationViewSnapshot } from "./types";
import { type RoomOfRoomPickerView } from "../../core/RoomPickerView";

type SectionCreationProps = SectionCreationViewSnapshot & SectionCreationViewActions;

const SectionCreationViewWrapperImpl = ({
    createOrEditSection,
    setSection,
    toggleRoom,
    search,
    unSelectLastRoom,
    renderRoomAvatar,
    ...rest
}: SectionCreationProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        createOrEditSection,
        setSection,
        toggleRoom,
        search,
        unSelectLastRoom,
        renderRoomAvatar,
    });
    return <SectionCreationView vm={vm} />;
};
const SectionCreationViewWrapper = withViewDocs(SectionCreationViewWrapperImpl, SectionCreationView);

const meta = {
    title: "Room List/SectionCreationView",
    component: SectionCreationViewWrapper,
    tags: ["autodocs"],
    args: {
        value: "",
        step: "creation",
        placeholder: "Search for people or rooms",
        listTitle: "Suggested",
        emptyListText: "No rooms found",
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
        createOrEditSection: fn(),
        setSection: fn(),
        toggleRoom: fn(),
        search: fn(),
        unSelectLastRoom: fn(),
        renderRoomAvatar: (room: RoomOfRoomPickerView, size: string): JSX.Element => (
            <div style={{ width: size, height: size, backgroundColor: "#ccc", borderRadius: "50%" }} />
        ),
    },
    parameters: {
        design: {
            type: "figma",
            url: "hhttps://www.figma.com/design/qurBlLqjf3mRNpyZ1ffamm/ER-213---Sections?node-id=1442-38764&t=XDtseNZTt6iPX8S6-4",
        },
    },
} satisfies Meta<typeof SectionCreationViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Creation mode: no existing section name, so the explanatory description is shown
 * and the text field starts empty.
 */
export const Default: Story = {};

/**
 * Editing mode: the field is pre-filled with the existing section name and the
 * description is hidden.
 */
export const Edition: Story = {
    args: {
        value: "My section",
        step: "editing",
    },
};

/**
 * Add rooms mode: the field is pre-filled with the existing section name.
 */
export const AddRooms: Story = {
    args: {
        value: "My section",
        step: "add_rooms",
    },
};
