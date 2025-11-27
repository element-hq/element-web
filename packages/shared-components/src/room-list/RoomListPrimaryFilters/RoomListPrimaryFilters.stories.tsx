/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomListPrimaryFilters, type RoomListPrimaryFiltersSnapshot } from "./RoomListPrimaryFilters";
import type { FilterViewModel } from "./useVisibleFilters";
import { type ViewModel } from "../../viewmodel/ViewModel";

const meta: Meta<typeof RoomListPrimaryFilters> = {
    title: "Room List/RoomListPrimaryFilters",
    component: RoomListPrimaryFilters,
    tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RoomListPrimaryFilters>;

function createMockViewModel(snapshot: RoomListPrimaryFiltersSnapshot): ViewModel<RoomListPrimaryFiltersSnapshot> {
    return {
        getSnapshot: () => snapshot,
        subscribe: () => () => {},
    };
}

// Mock filter data - simple presentation data only
const createFilters = (selectedIndex: number = 0): FilterViewModel[] => {
    const filterNames = ["All", "People", "Rooms", "Favourites", "Unread"];

    return filterNames.map((name, index) => ({
        name,
        active: index === selectedIndex,
        toggle: () => console.log(`Filter toggled: ${name}`),
    }));
};

export const Default: Story = {
    args: {
        vm: createMockViewModel({
            filters: createFilters(0),
        }),
    },
};

export const PeopleSelected: Story = {
    args: {
        vm: createMockViewModel({
            filters: createFilters(1),
        }),
    },
};

export const FewFilters: Story = {
    args: {
        vm: createMockViewModel({
            filters: [
                {
                    name: "All",
                    active: true,
                    toggle: () => console.log("All toggled"),
                },
                {
                    name: "Unread",
                    active: false,
                    toggle: () => console.log("Unread toggled"),
                },
            ],
        }),
    },
};
