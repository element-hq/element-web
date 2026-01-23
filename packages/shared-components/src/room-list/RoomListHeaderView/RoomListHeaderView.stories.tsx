/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import {
    RoomListHeaderView,
    type RoomListHeaderViewActions,
    type RoomListHeaderViewSnapshot,
} from "./RoomListHeaderView";
import { useMockedViewModel } from "../../viewmodel";
import { defaultSnapshot } from "./default-snapshot";

type RoomListHeaderProps = RoomListHeaderViewSnapshot & RoomListHeaderViewActions;

const RoomListHeaderViewWrapper = ({
    createChatRoom,
    createRoom,
    createVideoRoom,
    openSpaceHome,
    openSpaceSettings,
    inviteInSpace,
    openSpacePreferences,
    sort,
    toggleMessagePreview,
    ...rest
}: RoomListHeaderProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        createChatRoom,
        createRoom,
        createVideoRoom,
        openSpaceHome,
        openSpaceSettings,
        inviteInSpace,
        sort,
        openSpacePreferences,
        toggleMessagePreview,
    });
    return <RoomListHeaderView vm={vm} />;
};

export default {
    title: "Room List/RoomListHeaderView",
    component: RoomListHeaderViewWrapper,
    tags: ["autodocs"],
    args: {
        ...defaultSnapshot,
        createChatRoom: fn(),
        createRoom: fn(),
        createVideoRoom: fn(),
        openSpaceHome: fn(),
        openSpaceSettings: fn(),
        inviteInSpace: fn(),
        sort: fn(),
        openSpacePreferences: fn(),
        toggleMessagePreview: fn(),
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/vlmt46QDdE4dgXDiyBJXqp/ER-33-Left-Panel?node-id=2925-19173",
        },
    },
} as Meta<typeof RoomListHeaderViewWrapper>;

const Template: StoryFn<typeof RoomListHeaderViewWrapper> = (args) => <RoomListHeaderViewWrapper {...args} />;

export const Default = Template.bind({});

export const NoSpaceMenu = Template.bind({});
NoSpaceMenu.args = {
    displaySpaceMenu: false,
};

export const NoComposeMenu = Template.bind({});
NoComposeMenu.args = {
    displayComposeMenu: false,
};
