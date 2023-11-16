/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Room } from "matrix-js-sdk/src/matrix";

import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { inviteToRoom } from "../../../src/utils/room/inviteToRoom";
import { getMockClientWithEventEmitter } from "../../test-utils";

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
