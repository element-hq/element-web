/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { Pill } from "./Pill";
import { I18nApi, I18nContext } from "../..";

const meta = {
    title: "PillInput/Pill",
    component: Pill,
    tags: ["autodocs"],
    args: {
        label: "Pill",
        children: <div style={{ width: 20, height: 20, borderRadius: "100%", backgroundColor: "#ccc" }} />,
        onClick: fn(),
    },
} satisfies Meta<typeof Pill>;

export default meta;

const Template: StoryFn<typeof Pill> = (args) => {
    return (
        <I18nContext.Provider value={new I18nApi()}>
            <Pill {...args} />
        </I18nContext.Provider>
    );
};

export const Default = Template.bind({});
export const WithoutCloseButton = Template.bind({
    args: {
        onClick: undefined,
    },
});
