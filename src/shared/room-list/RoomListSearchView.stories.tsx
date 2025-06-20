/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { fn } from "storybook/test";
import React, { type ComponentProps, type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { RoomListSearchView } from "./RoomListSearchView";

const Template = (args: ComponentProps<typeof RoomListSearchView>): JSX.Element => {
    return (
        <div style={{ width: "400px", display: "flex", flexDirection: "column" }}>
            <RoomListSearchView {...args} />
        </div>
    );
};

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
    tags: ["autodocs"],
    title: "RoomList/RoomListSearchView",
    component: Template,
    parameters: {
        layout: "centered",
        design: {
            type: "figma",
            url: "https://www.figma.com/design/vlmt46QDdE4dgXDiyBJXqp/ER-33-Left-Panel-2025?node-id=258-39485",
        },
    },
    // More on argTypes: https://storybook.js.org/docs/api/argtypes
    // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#action-args
    args: {
        viewState: {
            displayDialButton: true,
            displayExploreButton: true,
        },
        actions: {
            onSearchClick: fn(),
            onDialPadClick: fn(),
            onExploreClick: fn(),
        },
    },
} satisfies Meta<typeof RoomListSearchView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
