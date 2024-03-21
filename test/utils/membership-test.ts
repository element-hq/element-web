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

import { MatrixClient, MatrixEvent, Room, RoomMember, RoomState, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { isKnockDenied, waitForMember } from "../../src/utils/membership";
import { createTestClient, mkRoomMember, stubClient } from "../test-utils";

describe("isKnockDenied", () => {
    const userId = "alice";
    let client: jest.Mocked<MatrixClient>;
    let room: Room;

    beforeEach(() => {
        client = stubClient() as jest.Mocked<MatrixClient>;
        room = new Room("!room-id:example.com", client, "@user:example.com");
    });

    it("checks that the user knock has been denied", () => {
        const roomMember = mkRoomMember(room.roomId, userId, "leave", true, { membership: "knock" });
        jest.spyOn(room, "getMember").mockReturnValue(roomMember);
        expect(isKnockDenied(room)).toBe(true);
    });

    it.each([
        { membership: "leave", isKicked: false, prevMembership: "invite" },
        { membership: "leave", isKicked: true, prevMembership: "invite" },
        { membership: "leave", isKicked: false, prevMembership: "join" },
        { membership: "leave", isKicked: true, prevMembership: "join" },
    ])("checks that the user knock has been not denied", ({ membership, isKicked, prevMembership }) => {
        const roomMember = mkRoomMember(room.roomId, userId, membership, isKicked, { membership: prevMembership });
        jest.spyOn(room, "getMember").mockReturnValue(roomMember);
        expect(isKnockDenied(room)).toBe(false);
    });
});

/* Shorter timeout, we've got tests to run */
const timeout = 30;

describe("waitForMember", () => {
    const STUB_ROOM_ID = "!stub_room:domain";
    const STUB_MEMBER_ID = "!stub_member:domain";

    let client: MatrixClient;

    beforeEach(() => {
        client = createTestClient();

        // getRoom() only knows about !stub_room, which has only one member
        const stubRoom = {
            getMember: jest.fn().mockImplementation((userId) => {
                return userId === STUB_MEMBER_ID ? ({} as RoomMember) : null;
            }),
        };
        mocked(client.getRoom).mockImplementation((roomId) => {
            return roomId === STUB_ROOM_ID ? (stubRoom as unknown as Room) : null;
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("resolves with false if the timeout is reached", async () => {
        const result = await waitForMember(client, "", "", { timeout: 0 });
        expect(result).toBe(false);
    });

    it("resolves with false if the timeout is reached, even if other RoomState.newMember events fire", async () => {
        jest.useFakeTimers();
        const roomId = "!roomId:domain";
        const userId = "@clientId:domain";
        const resultProm = waitForMember(client, roomId, userId, { timeout });
        jest.advanceTimersByTime(50);
        expect(await resultProm).toBe(false);
        client.emit(
            RoomStateEvent.NewMember,
            undefined as unknown as MatrixEvent,
            undefined as unknown as RoomState,
            {
                roomId,
                userId: "@anotherClient:domain",
            } as RoomMember,
        );
        jest.useRealTimers();
    });

    it("resolves with true if RoomState.newMember fires", async () => {
        const roomId = "!roomId:domain";
        const userId = "@clientId:domain";
        const resultProm = waitForMember(client, roomId, userId, { timeout });
        client.emit(
            RoomStateEvent.NewMember,
            undefined as unknown as MatrixEvent,
            undefined as unknown as RoomState,
            { roomId, userId } as RoomMember,
        );
        expect(await resultProm).toBe(true);
    });

    it("resolves immediately if the user is already a member", async () => {
        jest.useFakeTimers();
        const resultProm = waitForMember(client, STUB_ROOM_ID, STUB_MEMBER_ID, { timeout });
        expect(await resultProm).toBe(true);
    });

    it("waits for the timeout if the room is known but the user is not", async () => {
        const result = await waitForMember(client, STUB_ROOM_ID, "@other_user", { timeout: 0 });
        expect(result).toBe(false);
    });
});
