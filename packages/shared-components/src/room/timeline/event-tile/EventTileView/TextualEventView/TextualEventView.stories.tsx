/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Meta, type StoryObj } from "@storybook/react-vite";
import React from "react";

import { TextualEventView as TextualEventComponent } from "./TextualEventView";
import { MockViewModel } from "../../../../../core/viewmodel/MockViewModel";

const meta = {
    title: "Timeline/Timeline Event/TextualEventView",
    component: TextualEventComponent,
    tags: ["autodocs"],
    args: {
        vm: new MockViewModel({ content: "Dummy textual event text" }),
    },
} satisfies Meta<typeof TextualEventComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLink: Story = {
    args: {
        vm: new MockViewModel({
            content: (
                <>
                    <span>Dummy [🤒] textual event text </span>
                    <a href="~">with link</a>
                </>
            ),
        }),
    },
};
