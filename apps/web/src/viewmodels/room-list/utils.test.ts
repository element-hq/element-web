/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import { createTestClient, mkStubRoom } from "test-utils";

import type { MatrixClient, Room, RoomState } from "matrix-js-sdk/src/matrix";
import { shouldShowComponent } from "../../customisations/helpers/UIComponents";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { showCreateNewRoom } from "../../utils/space";
import { hasCreateRoomRights, createRoom, hasAccessToNotificationMenu } from "./utils";

vi.mock("../../customisations/helpers/UIComponents", () => ({
    shouldShowComponent: vi.fn(),
}));

vi.mock("../../utils/space", () => ({
    showCreateNewRoom: vi.fn(),
}));

describe("utils", () => {
    let matrixClient: MatrixClient;
    let space: Room;

    beforeEach(() => {
        matrixClient = createTestClient();
        space = mkStubRoom("spaceId", "spaceName", matrixClient);
    });

    describe("createRoom", () => {
        it("should fire Action.CreateRoom when createRoom is called without a space", async () => {
            const spy = vi.spyOn(defaultDispatcher, "fire");
            await createRoom();

            expect(spy).toHaveBeenCalledWith(Action.CreateRoom);
        });

        it("should call showCreateNewRoom when createRoom is called in a space", async () => {
            await createRoom(space);
            expect(showCreateNewRoom).toHaveBeenCalledWith(space);
        });
    });

    describe("hasCreateRoomRights", () => {
        it("should return false when UIComponent.CreateRooms is disabled", () => {
            vi.mocked(shouldShowComponent).mockReturnValue(false);
            expect(hasCreateRoomRights(matrixClient, space)).toBe(false);
        });

        it("should return true when UIComponent.CreateRooms is enabled and no space", () => {
            vi.mocked(shouldShowComponent).mockReturnValue(true);
            expect(hasCreateRoomRights(matrixClient)).toBe(true);
        });

        it("should return false in space when UIComponent.CreateRooms is enabled and the user doesn't have the rights", () => {
            vi.mocked(shouldShowComponent).mockReturnValue(true);
            vi.spyOn(space.getLiveTimeline(), "getState").mockReturnValue({
                maySendStateEvent: vi.fn().mockReturnValue(true),
            } as unknown as RoomState);

            expect(hasCreateRoomRights(matrixClient)).toBe(true);
        });
    });

    it("hasAccessToNotificationMenu", () => {
        vi.mocked(shouldShowComponent).mockReturnValue(true);
        const room = mkStubRoom("roomId", "roomName", matrixClient);
        const isGuest = false;
        const isArchived = false;

        expect(hasAccessToNotificationMenu(room, isGuest, isArchived)).toBe(true);
    });
});
