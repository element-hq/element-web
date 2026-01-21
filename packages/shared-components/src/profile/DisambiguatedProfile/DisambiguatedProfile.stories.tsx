/*
 * Copyright 2026 New Vector Ltd.
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
import { useMockedViewModel } from "../../useMockedViewModel";


type DisambiguatedProfileProps = DisambiguatedProfileViewSnapshot & DisambiguatedProfileViewActions;

const DisambiguatedProfileViewWrapper = ({ onClick, ...rest }: DisambiguatedProfileProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { onClick });
    return <DisambiguatedProfileView vm={vm} />;
};

export default {
    title: "Profile/DisambiguatedProfile",
    component: DisambiguatedProfileView,
    tags: ["autodocs"],
    args: {
        member: {
            rawDisplayName: "Alice",
            userId: "@alice:example.org",
            roomId: "!room:example.org",
            disambiguate: false,
        },
        emphasizeDisplayName: true,
        onClick: fn(),
    },
} as Meta<typeof DisambiguatedProfileView>;

const Template: StoryFn<typeof DisambiguatedProfileViewWrapper> = (args) => (
    <DisambiguatedProfileViewWrapper {...args} />
);

export const Default = Template.bind({});

export const WithMxid = Template.bind({});
WithMxid.args = {
    member: {
        rawDisplayName: "Alice",
        userId: "@alice:example.org",
        roomId: "!room:example.org",
        disambiguate: true,
    },
    colored: true,
};

export const WithColorClass = Template.bind({});
WithColorClass.args = {
    member: {
        rawDisplayName: "Bob",
        userId: "@bob:example.org",
        roomId: "!room:example.org",
        disambiguate: false,
    },
    colored: true,
};

export const Emphasized = Template.bind({});
Emphasized.args = {
    member: {
        rawDisplayName: "Charlie",
        userId: "@charlie:example.org",
        roomId: "!room:example.org",
        disambiguate: false,
    },
    emphasizeDisplayName: true,
};

export const WithTooltip = Template.bind({});
WithTooltip.args = {
    member: {
        rawDisplayName: "Diana",
        userId: "@diana:example.org",
        roomId: "!room:example.org",
        disambiguate: false,
    },
    withTooltip: true,
};

export const FullExample = Template.bind({});
FullExample.args = {
    member: {
        rawDisplayName: "Eve",
        userId: "@eve:matrix.org",
        roomId: "!room:example.org",
        disambiguate: false,
    },
    colored: true,
    emphasizeDisplayName: true,
    withTooltip: true,
};
