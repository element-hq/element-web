/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Room } from "matrix-js-sdk/src/matrix";

import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { inviteToRoom } from "../../../../src/utils/room/inviteToRoom";
import { getMockClientWithEventEmitter } from "../../../test-utils";

describe("inviteToRoom()", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";

    const makeRoom = (): Room => {
        const client = getMockClientWithEventEmitter({
            isGuest: jest.fn(),
        });
        const room = new Room(roomId, client, userId);
        return room;
    };

    beforeEach(() => {
        // stub
        jest.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("requires registration when a guest tries to invite to a room", () => {
        const room = makeRoom();

        jest.spyOn(room.client, "isGuest").mockReturnValue(true);

        inviteToRoom(room);

        expect(defaultDispatcher.dispatch).toHaveBeenCalledTimes(1);
        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "require_registration" });
    });

    it("opens the room inviter", () => {
        const room = makeRoom();

        jest.spyOn(room.client, "isGuest").mockReturnValue(false);

        inviteToRoom(room);

        expect(defaultDispatcher.dispatch).toHaveBeenCalledTimes(1);
        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "view_invite", roomId });
    });
});
