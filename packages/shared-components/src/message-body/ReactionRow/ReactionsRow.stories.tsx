/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReactionsRowButtonView } from "../ReactionsRowButton";
import { useMockedViewModel } from "../../viewmodel";
import {
    ReactionsRowView,
    type ReactionsRowViewActions,
    type ReactionsRowViewSnapshot,
} from "./ReactionsRowView";

interface MockReactionButtonProps {
    content: string;
    count: number;
    isSelected?: boolean;
}

const MockReactionButton = ({ content, count, isSelected }: Readonly<MockReactionButtonProps>): JSX.Element => {
    const tooltipVm = useMockedViewModel(
        {
            formattedSenders: "Alice and Bob",
            caption: undefined,
            tooltipOpen: false,
        },
        {},
    );

    const vm = useMockedViewModel(
        {
            content,
            count,
            isSelected: !!isSelected,
            isDisabled: false,
            tooltipVm,
            "aria-label": `${count} reactions for ${content}`,
        },
        {
            onClick: fn(),
        },
    );

    return <ReactionsRowButtonView vm={vm} />;
};

const DefaultReactionButtons = (): JSX.Element => (
    <>
        <MockReactionButton content="👍" count={4} isSelected />
        <MockReactionButton content="🎉" count={2} />
        <MockReactionButton content="👀" count={1} />
    </>
);

type WrapperProps = ReactionsRowViewSnapshot & Partial<ReactionsRowViewActions>;

const ReactionsRowViewWrapper = ({
    onShowAllClick,
    onAddReactionClick,
    onAddReactionContextMenu,
    ...snapshotProps
}: WrapperProps): JSX.Element => {
    const vm = useMockedViewModel(snapshotProps, {
        onShowAllClick: onShowAllClick ?? fn(),
        onAddReactionClick: onAddReactionClick ?? fn(),
        onAddReactionContextMenu: onAddReactionContextMenu ?? fn(),
    });

    return <ReactionsRowView vm={vm} />;
};

const meta = {
    title: "MessageBody/ReactionsRow",
    component: ReactionsRowViewWrapper,
    tags: ["autodocs"],
    args: {
        ariaLabel: "Reactions",
        isVisible: true,
        children: <DefaultReactionButtons />,
        showAllButtonVisible: false,
        showAllButtonLabel: "Show all",
        showAddReactionButton: true,
        addReactionButtonLabel: "Add reaction",
        addReactionButtonVisible: true,
        addReactionButtonActive: false,
        addReactionButtonDisabled: false,
    },
} satisfies Meta<typeof ReactionsRowViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithShowAllButton: Story = {
    args: {
        showAllButtonVisible: true,
    },
};

export const AddReactionButtonActive: Story = {
    args: {
        addReactionButtonActive: true,
    },
};

export const AddReactionButtonHiddenUntilHover: Story = {
    args: {
        addReactionButtonVisible: false,
    },
};

export const Hidden: Story = {
    args: {
        isVisible: false,
    },
};
