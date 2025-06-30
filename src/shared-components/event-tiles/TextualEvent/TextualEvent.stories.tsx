/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Meta, type StoryFn } from "@storybook/react";

import { TextualEvent as TextualEventComponent } from "./TextualEvent";

export default {
    title: "Icon/BigIcon",
    component: TextualEventComponent,
    tags: ["autodocs"],
    args: {},
} as Meta<typeof TextualEventComponent>;

const Template: StoryFn<typeof TextualEventComponent> = (args) => <TextualEventComponent {...args} />;

export const Default = Template.bind({});
