/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryFn } from "@storybook/react-vite";
import TimelineSeparator from "./TimelineSeparator";
import styles from "./TimelineSeparator.module.css";

export default {
    title: "MessageBody/TimelineSeparator",
    component: TimelineSeparator,
    tags: ["autodocs"],
    args: {
        label: "Label Separator",
        children: "Timeline Separator",
    },
} as Meta<typeof TimelineSeparator>;

const Template: StoryFn<typeof TimelineSeparator> = (args) => <TimelineSeparator {...args} />;

export const Default = Template.bind({});

export const WithHtmlChild = Template.bind({});
WithHtmlChild.args = {
    label: "Custom Label",
    children: (
        <h2 className={styles.timelineSeparator} aria-hidden="true">
            Thursday
        </h2>
    ),
};

export const WithDateEvent = Template.bind({});
WithDateEvent.args = {
    label: "Date Event Separator",
    children: "Wednesday",
};

export const WithLateEvent = Template.bind({});
WithLateEvent.args = {
    label: "Late Event Separator",
    children: "Fri, Jan 9, 2026",
};

export const WithoutChildren = Template.bind({});
WithoutChildren.args = {
    children: undefined,
    label: "Separator without children",
};
