/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomListPrimaryFilters } from "./RoomListPrimaryFilters";
import type { Filter } from "./useVisibleFilters";

const meta: Meta<typeof RoomListPrimaryFilters> = {
    title: "Room List/RoomListPrimaryFilters",
    component: RoomListPrimaryFilters,
    tags: ["autodocs"],
    args: {
        onToggleFilter: () => {},
    },
};

export default meta;
type Story = StoryObj<typeof RoomListPrimaryFilters>;

// Mock filter data - simple presentation data only
const createFilters = (selectedIndex: number = 0): Filter[] => {
    const filterNames = ["All", "People", "Rooms", "Favourites", "Unread"];

    return filterNames.map((name, index) => ({
        name,
        active: index === selectedIndex,
    }));
};

export const Default: Story = {
    args: {
        filters: createFilters(0),
    },
};

export const PeopleSelected: Story = {
    args: {
        filters: createFilters(1),
    },
};

export const FewFilters: Story = {
    args: {
        filters: [
            {
                name: "All",
                active: true,
            },
            {
                name: "Unread",
                active: false,
            },
        ],
    },
};
