/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import type { Meta, StoryFn } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { useMockedViewModel } from "../../viewmodel";
import {
    ReactionRowView,
    type ReactionRowViewActions,
    type ReactionRowViewSnapshot,
} from "./ReactionRowView";

type ReactionRowProps = ReactionRowViewSnapshot & ReactionRowViewActions;

const ReactionRowViewWrapper = ({ onShowAllClick, ...snapshot }: ReactionRowProps): JSX.Element => {
    const vm = useMockedViewModel(snapshot, { onShowAllClick });
    return <ReactionRowView vm={vm} />;
};

export default {
    title: "MessageBody/ReactionRow",
    component: ReactionRowViewWrapper,
    tags: ["autodocs"],
    argTypes: {
        isVisible: { control: "boolean" },
        showAllVisible: { control: "boolean" },
        showAllLabel: { control: "text" },
        toolbarAriaLabel: { control: "text" },
    },
    args: {
        onShowAllClick: fn(),
    },
} as Meta<typeof ReactionRowViewWrapper>;

const Template: StoryFn<typeof ReactionRowViewWrapper> = (args) => <ReactionRowViewWrapper {...args} />;

export const Default = Template.bind({});
Default.args = {
    isVisible: true,
    items: [<button key="1">👍 3</button>, <button key="2">🎉 2</button>],
    showAllVisible: false,
    showAllLabel: "Show all",
    toolbarAriaLabel: "Reactions",
    addReactionButton: <button>+</button>,
};

export const WithShowAll = Template.bind({});
WithShowAll.args = {
    ...Default.args,
    showAllVisible: true,
};

export const Hidden = Template.bind({});
Hidden.args = {
    ...Default.args,
    isVisible: false,
};
