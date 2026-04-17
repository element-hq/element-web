/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { fn } from "storybook/test";

import { type RoomListItemViewActions } from "./RoomListItemView";

export const mockedActions: RoomListItemViewActions = {
    onOpenRoom: fn(),
    onMarkAsRead: fn(),
    onMarkAsUnread: fn(),
    onToggleFavorite: fn(),
    onToggleLowPriority: fn(),
    onInvite: fn(),
    onCopyRoomLink: fn(),
    onLeaveRoom: fn(),
    onSetRoomNotifState: fn(),
    onCreateSection: fn(),
};
