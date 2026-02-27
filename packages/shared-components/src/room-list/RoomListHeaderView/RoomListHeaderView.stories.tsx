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
    RoomListHeaderView,
    type RoomListHeaderViewActions,
    type RoomListHeaderViewSnapshot,
} from "./RoomListHeaderView";
import { useMockedViewModel } from "../../viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import { defaultSnapshot } from "./default-snapshot";

type RoomListHeaderProps = RoomListHeaderViewSnapshot & RoomListHeaderViewActions;

const RoomListHeaderViewWrapperImpl = ({
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
const RoomListHeaderViewWrapper = withViewDocs(RoomListHeaderViewWrapperImpl, RoomListHeaderView);

const meta = {
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
} satisfies Meta<typeof RoomListHeaderViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoSpaceMenu: Story = {
    args: {
        displaySpaceMenu: false,
    },
};

export const NoComposeMenu: Story = {
    args: {
        displayComposeMenu: false,
    },
};

export const LongTitle: Story = {
    decorators: [
        (Story) => (
            <div style={{ width: "200px" }}>
                <Story />
            </div>
        ),
    ],
    args: {
        title: "Loooooooooooooooooooooooooooooooooooooong title",
    },
};
