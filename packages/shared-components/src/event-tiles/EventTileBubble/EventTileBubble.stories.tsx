/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { LockSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { EventTileBubble } from "./EventTileBubble";

export default {
    title: "Event/EventTileBubble",
    component: EventTileBubble,
    tags: ["autodocs"],
    args: {
        title: "Title goes here",
        subtitle: "Subtitle goes here",
        className: "custom-class",
        icon: undefined
    },
} as Meta<typeof EventTileBubble>;

const Template: StoryFn<typeof EventTileBubble> = (args) => <EventTileBubble {...args} />;

export const Default = Template.bind({});

export const HasLockSolidIcon = Template.bind({});
HasLockSolidIcon.args = {
    className: undefined,
    icon: <LockSolidIcon />,
    timestamp: undefined,
    children: undefined,
};

export const HasChildren = Template.bind({});
HasChildren.args = {
    className: undefined,
    timestamp: undefined,
    children: <div>children</div>,
};

export const HasTimestamp = Template.bind({});
HasTimestamp.args = {
    className: undefined,
    icon: <LockSolidIcon />,
    timestamp: <div>timestamp</div>,
    children: undefined,
};

export const HasTimestampAndChildren = Template.bind({});
HasTimestampAndChildren.args = {
    className: undefined,
    icon: <LockSolidIcon />,
    timestamp: <div>timestamp</div>,
    children: <div>children</div>,
};

export const IsCryptoEventBubble = Template.bind({});
IsCryptoEventBubble.args = {
    className: undefined,
    icon: <LockSolidIcon />,
    title: "Encryption enabled",
    subtitle: "Messages here are end-to-end encrypted. Verify XYZ in their profile - tap on their profile picture.",
    timestamp: undefined,
    children: undefined,
};

