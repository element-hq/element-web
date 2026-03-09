/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { LinkedText } from "./LinkedText";
import { LinkedTextContext } from "./LinkedTextContext";

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
} satisfies Meta<ComponentProps<typeof LinkedText> & ComponentProps<typeof LinkedTextContext>["value"]>;

const Template: StoryFn<ComponentProps<typeof LinkedText> & ComponentProps<typeof LinkedTextContext>["value"]> = ({
    children,
    ...args
}) => (
    <LinkedTextContext.Provider value={args}>
        <LinkedText>{children}</LinkedText>
    </LinkedTextContext.Provider>
);

export const Default = Template.bind({});
Default.args = {};

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
WithCustomUrlTarget.tags = ["skip-test"];
WithCustomUrlTarget.args = {
    urlTargetTransformer: () => "_fake_target",
};

export const WithCustomHref = Template.bind({});

WithCustomHref.tags = ["skip-test"];
WithCustomHref.args = {
    hrefTransformer: () => {
        return "https://example.org";
    },
};
