/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { mocked } from "jest-mock";

import type { MatrixClient, Room, RoomState } from "matrix-js-sdk/src/matrix";
import { createTestClient, mkStubRoom } from "../../../../test-utils";
import { shouldShowComponent } from "../../../../../src/customisations/helpers/UIComponents";
import {
    hasCreateRoomRights,
    createRoom,
    hasAccessToNotificationMenu,
} from "../../../../../src/components/viewmodels/roomlist/utils";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { showCreateNewRoom } from "../../../../../src/utils/space";

jest.mock("../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

jest.mock("../../../../../src/utils/space", () => ({
    showCreateNewRoom: jest.fn(),
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
            const spy = jest.spyOn(defaultDispatcher, "fire");
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
            mocked(shouldShowComponent).mockReturnValue(false);
            expect(hasCreateRoomRights(matrixClient, space)).toBe(false);
        });

        it("should return true when UIComponent.CreateRooms is enabled and no space", () => {
            mocked(shouldShowComponent).mockReturnValue(true);
            expect(hasCreateRoomRights(matrixClient)).toBe(true);
        });

        it("should return false in space when UIComponent.CreateRooms is enabled and the user doesn't have the rights", () => {
            mocked(shouldShowComponent).mockReturnValue(true);
            jest.spyOn(space.getLiveTimeline(), "getState").mockReturnValue({
                maySendStateEvent: jest.fn().mockReturnValue(true),
            } as unknown as RoomState);

            expect(hasCreateRoomRights(matrixClient)).toBe(true);
        });
    });

    it("hasAccessToNotificationMenu", () => {
        mocked(shouldShowComponent).mockReturnValue(true);
        const room = mkStubRoom("roomId", "roomName", matrixClient);
        const isGuest = false;
        const isArchived = false;

        expect(hasAccessToNotificationMenu(room, isGuest, isArchived)).toBe(true);
    });
});
