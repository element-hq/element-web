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
    type RoomListSectionHeaderViewSnapshot,
    type RoomListSectionHeaderActions,
} from "../RoomListSectionHeaderView";
import { RoomListSectionHeaderDragOverlayView } from "./RoomListSectionHeaderDragOverlayView";
import { useMockedViewModel } from "../../../core/viewmodel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";

type RoomListSectionHeaderDragOverlayProps = RoomListSectionHeaderViewSnapshot & RoomListSectionHeaderActions;

const RoomListSectionHeaderDragOverlayWrapperImpl = ({
    onClick,
    editSection,
    removeSection,
    ...rest
}: RoomListSectionHeaderDragOverlayProps): JSX.Element => {
    const vm = useMockedViewModel(rest, { onClick, editSection, removeSection });
    return <RoomListSectionHeaderDragOverlayView vm={vm} />;
};
const RoomListSectionHeaderDragOverlayWrapper = withViewDocs(
    RoomListSectionHeaderDragOverlayWrapperImpl,
    RoomListSectionHeaderDragOverlayView,
);

const meta = {
    title: "Room List/RoomListSectionHeaderDragOverlayView",
    component: RoomListSectionHeaderDragOverlayWrapper,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div style={{ width: "320px", padding: "8px" }}>
                <Story />
            </div>
        ),
    ],
    args: {
        id: "element.io.section.abc123",
        title: "Work",
        isExpanded: true,
        isUnread: false,
        displaySectionMenu: true,
        canBeReordered: true,
        onClick: fn(),
        editSection: fn(),
        removeSection: fn(),
    },
} satisfies Meta<typeof RoomListSectionHeaderDragOverlayWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
