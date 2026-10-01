/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    RoomListSearchView,
    type RoomListSearchViewActions,
    type RoomListSearchViewSnapshot,
} from "./RoomListSearchView";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type RoomListSearchProps = RoomListSearchViewSnapshot & RoomListSearchViewActions;

const RoomListSearchViewWrapperImpl = ({
    onSearchClick,
    onDialPadClick,
    onExploreClick,
    ...rest
}: RoomListSearchProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onSearchClick,
        onDialPadClick,
        onExploreClick,
    });
    return <RoomListSearchView vm={vm} />;
};
const RoomListSearchViewWrapper = withViewDocs(RoomListSearchViewWrapperImpl, RoomListSearchView);

const meta = {
    title: "Room List/RoomListSearchView",
    component: RoomListSearchViewWrapper,
    tags: ["autodocs"],
    args: {
        displayExploreButton: true,
        displayDialButton: false,
        searchShortcut: "⌘ K",
        onSearchClick: fn(),
        onDialPadClick: fn(),
        onExploreClick: fn(),
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/vlmt46QDdE4dgXDiyBJXqp/ER-33-Left-Panel-2025?node-id=98-1979&t=vafb4zoYMNLRuAbh-4",
        },
    },
} satisfies Meta<typeof RoomListSearchViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDialPad: Story = {
    args: {
        displayDialButton: true,
    },
};

export const WithoutExplore: Story = {
    args: {
        displayExploreButton: false,
    },
};

export const AllButtons: Story = {
    args: {
        displayExploreButton: true,
        displayDialButton: true,
        searchShortcut: "⌘ K",
    },
};
