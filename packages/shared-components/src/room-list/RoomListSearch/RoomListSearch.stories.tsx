/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomListSearch, type RoomListSearchSnapshot } from "./RoomListSearch";
import { type ViewModel } from "../../viewmodel/ViewModel";

const meta: Meta<typeof RoomListSearch> = {
    title: "Room List/RoomListSearch",
    component: RoomListSearch,
    tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RoomListSearch>;

function createMockViewModel(snapshot: RoomListSearchSnapshot): ViewModel<RoomListSearchSnapshot> {
    return {
        getSnapshot: () => snapshot,
        subscribe: () => () => {},
    };
}

export const Default: Story = {
    args: {
        vm: createMockViewModel({
            onSearchClick: () => console.log("Open search"),
            showDialPad: false,
            showExplore: false,
        }),
    },
};

export const WithDialPad: Story = {
    args: {
        vm: createMockViewModel({
            onSearchClick: () => console.log("Open search"),
            showDialPad: true,
            onDialPadClick: () => console.log("Open dial pad"),
            showExplore: false,
        }),
    },
};

export const WithExplore: Story = {
    args: {
        vm: createMockViewModel({
            onSearchClick: () => console.log("Open search"),
            showDialPad: false,
            showExplore: true,
            onExploreClick: () => console.log("Explore rooms"),
        }),
    },
};

export const WithAllActions: Story = {
    args: {
        vm: createMockViewModel({
            onSearchClick: () => console.log("Open search"),
            showDialPad: true,
            onDialPadClick: () => console.log("Open dial pad"),
            showExplore: true,
            onExploreClick: () => console.log("Explore rooms"),
        }),
    },
};
