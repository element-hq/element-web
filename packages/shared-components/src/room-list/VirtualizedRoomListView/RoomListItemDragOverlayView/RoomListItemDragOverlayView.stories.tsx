/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    type Room,
    type RoomListItemViewActions,
    type RoomListItemViewSnapshot,
} from "../RoomListItemAccessibilityWrapper/RoomListItemView";
import { RoomListItemDragOverlayView } from "./RoomListItemDragOverlayView";
import { useMockedViewModel } from "../../../core/viewmodel";
import { withViewDocs } from "../../../../.storybook/withViewDocs";
import { defaultSnapshot } from "../RoomListItemAccessibilityWrapper/RoomListItemView/default-snapshot";
import { mockedActions } from "../RoomListItemAccessibilityWrapper/RoomListItemView/mocked-actions";
import { renderAvatar } from "../../story-mocks";

type RoomListItemDragOverlayProps = RoomListItemViewSnapshot &
    RoomListItemViewActions & {
        renderAvatar: (room: Room) => React.ReactElement;
    };

const RoomListItemDragOverlayWrapperImpl = ({
    onOpenRoom,
    onMarkAsRead,
    onMarkAsUnread,
    onToggleFavorite,
    onToggleLowPriority,
    onInvite,
    onCopyRoomLink,
    onLeaveRoom,
    onSetRoomNotifState,
    onCreateSection,
    onToggleSection,
    renderAvatar: renderAvatarProp,
    ...rest
}: RoomListItemDragOverlayProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onOpenRoom,
        onMarkAsRead,
        onMarkAsUnread,
        onToggleFavorite,
        onToggleLowPriority,
        onInvite,
        onCopyRoomLink,
        onLeaveRoom,
        onSetRoomNotifState,
        onCreateSection,
        onToggleSection,
    });
    return <RoomListItemDragOverlayView vm={vm} renderAvatar={renderAvatarProp} />;
};
const RoomListItemDragOverlayWrapper = withViewDocs(RoomListItemDragOverlayWrapperImpl, RoomListItemDragOverlayView);

const meta = {
    title: "Room List/RoomListItemDragOverlayView",
    component: RoomListItemDragOverlayWrapper,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div style={{ width: "320px", padding: "8px" }}>
                <Story />
            </div>
        ),
    ],
    args: {
        ...defaultSnapshot,
        ...mockedActions,
        renderAvatar,
    },
} satisfies Meta<typeof RoomListItemDragOverlayWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
