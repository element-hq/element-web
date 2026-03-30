/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    RoomListSectionHeaderView,
    type RoomListSectionHeaderViewSnapshot,
    type RoomListSectionHeaderActions,
    type RoomListSectionHeaderViewProps,
} from "./RoomListSectionHeaderView";
import { useMockedViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

type RoomListSectionHeaderProps = RoomListSectionHeaderViewSnapshot &
    RoomListSectionHeaderActions &
    Omit<RoomListSectionHeaderViewProps, "vm">;

const RoomListSectionHeaderViewWrapperImpl = ({
    onClick,
    onFocus,
    isFocused,
    sectionIndex,
    sectionCount,
    indexInList,
    roomCountInSection,
    ...rest
}: RoomListSectionHeaderProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { onClick });
    return (
        <RoomListSectionHeaderView
            vm={vm}
            onFocus={onFocus}
            isFocused={isFocused}
            sectionIndex={sectionIndex}
            sectionCount={sectionCount}
            indexInList={indexInList}
            roomCountInSection={roomCountInSection}
        />
    );
};
const RoomListSectionHeaderViewWrapper = withViewDocs(RoomListSectionHeaderViewWrapperImpl, RoomListSectionHeaderView);

const meta = {
    title: "Room List/RoomListSectionHeaderView",
    component: RoomListSectionHeaderViewWrapper,
    tags: ["autodocs"],
    args: {
        id: "favourites",
        title: "Favourites",
        isExpanded: true,
        isFocused: false,
        onClick: fn(),
        onFocus: fn(),
        sectionIndex: 1,
        sectionCount: 3,
        roomCountInSection: 5,
        indexInList: 3,
    },
    decorators: [
        (Story) => (
            <div role="treegrid" style={{ width: "320px" }}>
                <Story />
            </div>
        ),
    ],
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/rTaQE2nIUSLav4Tg3nozq7/Compound-Web-Components?node-id=10657-20703&p=f",
        },
    },
} satisfies Meta<typeof RoomListSectionHeaderViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Collapsed: Story = {
    args: {
        isExpanded: false,
    },
};

export const LongTitle: Story = {
    args: {
        title: "This is a very long title that should be truncated with an ellipsis",
    },
};

export const FirstHeader: Story = {
    args: {
        sectionIndex: 0,
    },
};

export const LastHeaderCollapsed: Story = {
    args: {
        isExpanded: false,
        sectionIndex: 2,
    },
};
