/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Meta, type StoryFn } from "@storybook/react-vite";

import { TextualEventView as TextualEventComponent } from "./TextualEventView";
import { MockViewModel } from "../../MockViewModel";

export default {
    title: "Event/TextualEvent",
    component: TextualEventComponent,
    tags: ["autodocs"],
    args: {
        vm: new MockViewModel({ content: "Dummy textual event text" }),
    },
} as Meta<typeof TextualEventComponent>;

const Template: StoryFn<typeof TextualEventComponent> = (args) => <TextualEventComponent {...args} />;

export const Default = Template.bind({});
