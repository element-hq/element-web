/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";
import { ReactionAddIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import type { Meta, StoryFn } from "@storybook/react-vite";
import { useMockedViewModel } from "../../viewmodel";
import styles from "./ReactionRow.module.css";
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
    items: [
        <button key="1" className={styles.reactionButton} type="button">
            <span className={styles.reactionButtonContent}>👍</span>
            <span>3</span>
        </button>,
        <button key="2" className={styles.reactionButton} type="button">
            <span className={styles.reactionButtonContent}>🎉</span>
            <span>2</span>
        </button>,
    ],
    showAllVisible: false,
    showAllLabel: "Show all",
    toolbarAriaLabel: "Reactions",
    addReactionButton: (
        <button className={styles.addReactionButton} aria-label="Add reaction" type="button">
            <ReactionAddIcon />
        </button>
    ),
};

export const ActiveAddReactionButton = Template.bind({});
ActiveAddReactionButton.args = {
    ...Default.args,
    addReactionButton: (
        <button className={`${styles.addReactionButton} ${styles.addReactionButtonActive}`} aria-label="Add reaction" type="button">
            <ReactionAddIcon />
        </button>
    ),
};

export const Hidden = Template.bind({});
Hidden.args = {
    ...Default.args,
    isVisible: false,
};
