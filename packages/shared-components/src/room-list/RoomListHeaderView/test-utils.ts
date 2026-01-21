/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { vi } from "vitest";

import { MockViewModel } from "../../viewmodel";
import { type RoomListHeaderViewActions, type RoomListHeaderViewSnapshot } from "./RoomListHeaderView";

/**
 * A mocked ViewModel for the RoomListHeaderView, for use in tests.
 */
export class MockedViewModel extends MockViewModel<RoomListHeaderViewSnapshot> implements RoomListHeaderViewActions {
    public createChatRoom = vi.fn<() => void>();
    public createRoom = vi.fn<() => void>();
    public createVideoRoom = vi.fn<() => void>();
    public openSpaceHome = vi.fn<() => void>();
    public openSpaceSettings = vi.fn<() => void>();
    public inviteInSpace = vi.fn<() => void>();
    public sort = vi.fn<() => void>();
    public openSpacePreferences = vi.fn<() => void>();
    public toggleMessagePreview = vi.fn<() => void>();
}

export const defaultSnapshot: RoomListHeaderViewSnapshot = {
    title: "Rooms",
    displayComposeMenu: true,
    displaySpaceMenu: true,
    canCreateRoom: true,
    canCreateVideoRoom: true,
    canInviteInSpace: true,
    canAccessSpaceSettings: true,
    activeSortOption: "recent",
    isMessagePreviewEnabled: true,
};
