/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { Clock } from "./Clock";
import { I18nContext } from "../../utils/i18nContext";
import { I18nApi } from "../../utils/I18nApi";

export default {
    title: "Audio/Clock",
    component: Clock,
    tags: ["autodocs"],
    args: {
        seconds: 20,
    },
} as Meta<typeof Clock>;

const Template: StoryFn<typeof Clock> = (args) => {
    return (
        <I18nContext.Provider value={new I18nApi()}>
            <Clock {...args} />
        </I18nContext.Provider>
    );
};

export const Default = Template.bind({});

export const LotOfSeconds = Template.bind({});
LotOfSeconds.args = {
    seconds: 99999999999999,
};
