/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fn } from "storybook/test";

import { PlayPauseButton } from "./PlayPauseButton";
import type { Meta, StoryFn } from "@storybook/react-vite";
import { I18nContext } from "../../utils/i18nContext";
import { I18nApi } from "../..";

const meta = {
    title: "Audio/PlayPauseButton",
    component: PlayPauseButton,
    tags: ["autodocs"],
    args: {
        togglePlay: fn(),
    },
} satisfies Meta<typeof PlayPauseButton>;

export default meta;

const Template: StoryFn<typeof PlayPauseButton> = (args) => {
    return (
        <I18nContext.Provider value={new I18nApi()}>
            <PlayPauseButton {...args} />
        </I18nContext.Provider>
    );
};

export const Default = Template.bind({});
export const Playing = Template.bind({});
Playing.args = {
    playing: true,
};
