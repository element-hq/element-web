/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryFn } from "@storybook/react-vite";
import {
    DisambiguatedProfileView,
    type DisambiguatedProfileViewSnapshot,
    type DisambiguatedProfileViewActions,
} from "./DisambiguatedProfileView";
import { useMockedViewModel } from "../../viewmodel";

type DisambiguatedProfileProps = DisambiguatedProfileViewSnapshot & DisambiguatedProfileViewActions;

const DisambiguatedProfileViewWrapper = ({ onClick, ...rest }: DisambiguatedProfileProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { onClick });
    return <DisambiguatedProfileView vm={vm} />;
};

export default {
    title: "Profile/DisambiguatedProfile",
    component: DisambiguatedProfileViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        displayName: { control: "text" },
        colorClass: { control: "text" },
        className: { control: "text" },
        displayIdentifier: { control: "text" },
        title: { control: "text" },
        emphasizeDisplayName: { control: "boolean" },
    },
    args: {
        displayName: "Alice",
        emphasizeDisplayName: true,
        onClick: fn(),
    },
} as Meta<typeof DisambiguatedProfileViewWrapper>;

const Template: StoryFn<typeof DisambiguatedProfileViewWrapper> = (args) => (
    <DisambiguatedProfileViewWrapper {...args} />
);

export const Default = Template.bind({});

export const WithMxid = Template.bind({});
WithMxid.args = {
    displayName: "Alice",
    displayIdentifier: "@alice:example.org",
    colorClass: "mx_Username_color1",
};

export const WithColorClass = Template.bind({});
WithColorClass.args = {
    displayName: "Bob",
    colorClass: "mx_Username_color3",
};

export const Emphasized = Template.bind({});
Emphasized.args = {
    displayName: "Charlie",
    emphasizeDisplayName: true,
};

export const WithTooltip = Template.bind({});
WithTooltip.args = {
    displayName: "Diana",
    title: "Diana (@diana:example.org)",
};

export const FullExample = Template.bind({});
FullExample.args = {
    displayName: "Eve",
    displayIdentifier: "@eve:matrix.org",
    colorClass: "mx_Username_color5",
    title: "Eve (@eve:matrix.org)",
    emphasizeDisplayName: true,
};
