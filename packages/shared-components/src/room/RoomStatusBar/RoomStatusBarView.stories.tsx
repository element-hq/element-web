/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import { type Meta, type StoryFn } from "@storybook/react-vite";
import React, { type JSX } from "react";
import { fn } from "storybook/test";

import { useMockedViewModel } from "../../useMockedViewModel";
import {
    RoomStatusBarView,
    type RoomStatusBarViewActions,
    type RoomStatusBarViewSnapshot,
} from "./RoomStatusBarView";

type RoomStatusBarProps = RoomStatusBarViewSnapshot & RoomStatusBarViewActions;

const RoomStatusBarViewWrapper = ({ onClose, ...rest }: RoomStatusBarProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onClose,
    });
    return <RoomStatusBarView vm={vm} />;
};

export default {
    title: "room/RoomStatusBarView",
    component: RoomStatusBarViewWrapper,
    tags: ["autodocs"],
    argTypes: {},
    args: {
        visible: true,
        onClose: fn(),
    },
} as Meta<typeof RoomStatusBarViewWrapper>;

const Template: StoryFn<typeof RoomStatusBarViewWrapper> = (args) => (
    <RoomStatusBarViewWrapper {...args} />
);

export const Default = Template.bind({});
