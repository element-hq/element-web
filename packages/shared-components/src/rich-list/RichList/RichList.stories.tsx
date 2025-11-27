/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import { RichList } from "./RichList";
import type { Meta, StoryFn } from "@storybook/react-vite";
import { RichItem } from "../RichItem";
import { I18nApi, I18nContext } from "../..";

const avatar = <div style={{ width: 32, height: 32, backgroundColor: "#ccc", borderRadius: "50%" }} />;

const meta = {
    title: "RichList/RichList",
    component: RichList,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div style={{ height: "220px", overflow: "hidden" }}>
                <Story />
            </div>
        ),
    ],
    args: {
        title: "Rich List Title",
        children: (
            <>
                <RichItem avatar={avatar} title="First Item" description="description" />
                <RichItem selected={true} avatar={avatar} title="Second Item" description="description" />
                <RichItem avatar={avatar} title="Third Item" description="description" />
                <RichItem avatar={avatar} title="Fourth Item" description="description" />
                <RichItem avatar={avatar} title="Fifth Item" description="description" />
            </>
        ),
    },
} satisfies Meta<typeof RichList>;

export default meta;

const Template: StoryFn<typeof RichList> = (args) => {
    return (
        <I18nContext.Provider value={new I18nApi()}>
            <RichList {...args} />
        </I18nContext.Provider>
    );
};

export const Default = Template.bind({});
export const Empty = Template.bind({});
Empty.args = {
    isEmpty: true,
    children: "No items available",
};
