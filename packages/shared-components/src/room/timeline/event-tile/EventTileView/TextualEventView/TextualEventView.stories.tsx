/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Meta, type StoryObj } from "@storybook/react-vite";

import { TextualEventView as TextualEventComponent } from "./TextualEventView";
import { MockViewModel } from "../../../../../core/viewmodel/MockViewModel";

const meta = {
    title: "Event/TextualEvent",
    component: TextualEventComponent,
    tags: ["autodocs"],
    args: {
        vm: new MockViewModel({ content: "Dummy textual event text" }),
    },
} satisfies Meta<typeof TextualEventComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
