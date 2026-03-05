/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { LinkedText } from "./LinkedText";

export default {
    title: "Utils/LinkedText",
    component: LinkedText,
    args: {
        children: "I love working on https://matrix.org.",
    },
    argTypes: {
        canClick: { control: "boolean" },
    },
    tags: ["autodocs"],
} satisfies Meta<typeof LinkedText>;

const Template: StoryFn<typeof LinkedText> = ({ children, ...args }) => <LinkedText {...args}>{children}</LinkedText>;

export const Default = Template.bind({});

Default.args = {};

export const Unclickable = Template.bind({});

Unclickable.args = {
    children: "I love working on https://matrix.org.",
    canClick: false,
};

export const WithUserId = Template.bind({});

WithUserId.args = {
    children: "I love talking to @alice:example.org.",
    userIdListener: fn(),
};

export const WithRoomAlias = Template.bind({});

WithRoomAlias.args = {
    children: "I love talking in #general:example.org.",
    roomAliasListener: fn(),
};

export const WithCustomUrlTarget = Template.bind({});

WithCustomUrlTarget.args = {
    urlTargetTransformer: () => "_fake_target",
};

export const WithCustomHref = Template.bind({});

WithCustomHref.args = {
    hrefTransformer: () => {
        return "https://example.org";
    },
};
