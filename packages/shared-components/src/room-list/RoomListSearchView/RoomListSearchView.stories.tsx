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
    RoomListSearchView,
    type RoomListSearchViewActions,
    type RoomListSearchViewSnapshot,
} from "./RoomListSearchView";
import { useMockedViewModel } from "../../useMockedViewModel";

type RoomListSearchProps = RoomListSearchViewSnapshot & RoomListSearchViewActions;

const RoomListSearchViewWrapper = ({
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

export default {
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
} as Meta<typeof RoomListSearchViewWrapper>;

const Template: StoryFn<typeof RoomListSearchViewWrapper> = (args) => <RoomListSearchViewWrapper {...args} />;

export const Default = Template.bind({});

export const WithDialPad = Template.bind({});
WithDialPad.args = {
    displayDialButton: true,
};

export const WithoutExplore = Template.bind({});
WithoutExplore.args = {
    displayExploreButton: false,
};

export const AllButtons = Template.bind({});
AllButtons.args = {
    displayExploreButton: true,
    displayDialButton: true,
    searchShortcut: "⌘ K",
};
