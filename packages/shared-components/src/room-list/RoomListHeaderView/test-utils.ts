/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { MockViewModel } from "../../viewmodel";
import { type RoomListHeaderViewActions, type RoomListHeaderViewSnapshot } from "./RoomListHeaderView";

/**
 * A mocked ViewModel for the RoomListHeaderView, for use in tests.
 */
export class MockedViewModel extends MockViewModel<RoomListHeaderViewSnapshot> implements RoomListHeaderViewActions {
    public createChatRoom = jest.fn();
    public createRoom = jest.fn();
    public createVideoRoom = jest.fn();
    public openSpaceHome = jest.fn();
    public openSpaceSettings = jest.fn();
    public inviteInSpace = jest.fn();
    public sort = jest.fn();
    public openSpacePreferences = jest.fn();
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
};
