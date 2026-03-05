/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React from "react";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { LinkedText } from "./LinkedText";

export default {
    title: "Utils/LinkedText",
    component: LinkedText,
    args: {
        children: "Test",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof LinkedText>;

const Template: StoryFn<typeof LinkedText> = ({ children, ...args }) => <LinkedText {...args}>{children}</LinkedText>;

export const Default = Template.bind({});

Default.args = {
    children: "I love working on https://matrix.org.",
};
