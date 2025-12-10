/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoomListSearch } from "./RoomListSearch";

const meta: Meta<typeof RoomListSearch> = {
    title: "Room List/RoomListSearch",
    component: RoomListSearch,
    tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RoomListSearch>;

export const Default: Story = {
    args: {
        onSearchClick: () => console.log("Open search"),
        showDialPad: false,
        showExplore: false,
    },
};

export const WithDialPad: Story = {
    args: {
        onSearchClick: () => console.log("Open search"),
        showDialPad: true,
        onDialPadClick: () => console.log("Open dial pad"),
        showExplore: false,
    },
};

export const WithExplore: Story = {
    args: {
        onSearchClick: () => console.log("Open search"),
        showDialPad: false,
        showExplore: true,
        onExploreClick: () => console.log("Explore rooms"),
    },
};

export const WithAllActions: Story = {
    args: {
        onSearchClick: () => console.log("Open search"),
        showDialPad: true,
        onDialPadClick: () => console.log("Open dial pad"),
        showExplore: true,
        onExploreClick: () => console.log("Explore rooms"),
    },
};
