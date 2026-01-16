/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { SeparatorKind, TimelineSeparatorView, type TimelineSeparatorViewSnapshot } from "./TimelineSeparatorView";
import { useMockedViewModel } from "../../useMockedViewModel";
import styles from "./TimelineSeparatorView.module.css";

type TimelineSeparatorProps = TimelineSeparatorViewSnapshot & {} ;
const TimelineSeparatorViewWrapper = (props: TimelineSeparatorProps): JSX.Element => {
    const vm = useMockedViewModel<TimelineSeparatorViewSnapshot, TimelineSeparatorProps>(
        {
            ...props,
        },
        {
            label: "",
            SeparatorKind: SeparatorKind.Date /* Default to Date kind for testing */ ,
        }
    );
    return <TimelineSeparatorView vm={vm} />;
};

export default {
    title: "MessageBody/TimelineSeparatorView",
    component: TimelineSeparatorViewWrapper,
    tags: ["autodocs"],
    args: {
        label: "Label Separator",
        children: "Timeline Separator",
        SeparatorKind: SeparatorKind.Date,
    },
} as Meta<typeof TimelineSeparatorViewWrapper>;

const Template: StoryFn<typeof TimelineSeparatorViewWrapper> = (args: any) => <TimelineSeparatorViewWrapper {...args} />;

export const Default = Template.bind({});

export const WithHtmlChild = Template.bind({});
WithHtmlChild.args = {
    label: "Custom Label",
    children: <h2 className={styles.mx_DateSeparator_dateHeading} aria-hidden="true">Thursday</h2>,
};

export const WithoutChildren = Template.bind({});
WithoutChildren.args = {
    children: undefined,
};




