/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type StoryObj, type Meta } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { withViewDocs } from "../../../.storybook/withViewDocs";
import { StartChatView, type StartChatViewSnapshot, type StartChatViewActions } from "./StartChatView";
import { useMockedViewModel } from "../../core/viewmodel";

type StartChatViewWrapperProps = StartChatViewSnapshot & StartChatViewActions;

const StartChatViewWrapperImpl = ({
    getAvatar,
    toggleFavourite,
    openNotifications,
    invite,
    ...rest
}: StartChatViewWrapperProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { getAvatar, toggleFavourite, openNotifications, invite });
    return <StartChatView vm={vm} />;
};
const StartChatViewWrapper = withViewDocs(StartChatViewWrapperImpl, StartChatView);

const meta = {
    title: "Room/StartChatView",
    component: StartChatViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        type: {
            control: "select",
            options: ["dm", "private_room", "public_room"],
        },
    },
    decorators: [
        (Story) => (
            <ul aria-label="timeline" style={{ all: "unset" }}>
                <Story />
            </ul>
        ),
    ],
    args: {
        isEncrypted: true,
        roomName: "Alice",
        dmName: "Alice",
        canInvite: false,
        isFavourite: false,
        type: "dm",
        getAvatar: () => <div style={{ width: 88, height: 88, backgroundColor: "grey", borderRadius: "100%" }} />,
        toggleFavourite: fn(),
        openNotifications: fn(),
        invite: fn(),
    },
} satisfies Meta<typeof StartChatViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DirectMessage: Story = {
    args: {
        type: "dm",
        roomName: "Alice",
        isEncrypted: true,
        canInvite: false,
        isFavourite: true,
    },
};

export const PublicRoom: Story = {
    args: {
        type: "public_room",
        roomName: "Public Room",
        isEncrypted: false,
        canInvite: true,
    },
};

export const PrivateRoom: Story = {
    args: {
        type: "private_room",
        roomName: "Private Room",
        isEncrypted: true,
        canInvite: true,
    },
};
