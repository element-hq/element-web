/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from "vitest";
import {
    type MatrixClient,
    type MatrixEvent,
    Room,
    type RoomMember,
    type RoomState,
    RoomStateEvent,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { createTestClient, mkRoomMember, stubClient } from "test-utils";

import { isKnockDenied, waitForMember } from "./membership";

describe("isKnockDenied", () => {
    const userId = "alice";
    let client: Mocked<MatrixClient>;
    let room: Room;

    beforeEach(() => {
        client = vi.mocked(stubClient());
        room = new Room("!room-id:example.com", client, "@user:example.com");
    });

    it("checks that the user knock has been denied", () => {
        const roomMember = mkRoomMember(room.roomId, userId, KnownMembership.Leave, true, {
            membership: KnownMembership.Knock,
        });
        vi.spyOn(room, "getMember").mockReturnValue(roomMember);
        expect(isKnockDenied(room)).toBe(true);
    });

    it.each([
        { membership: KnownMembership.Leave, isKicked: false, prevMembership: KnownMembership.Invite },
        { membership: KnownMembership.Leave, isKicked: true, prevMembership: KnownMembership.Invite },
        { membership: KnownMembership.Leave, isKicked: false, prevMembership: KnownMembership.Join },
        { membership: KnownMembership.Leave, isKicked: true, prevMembership: KnownMembership.Join },
    ])("checks that the user knock has been not denied", ({ membership, isKicked, prevMembership }) => {
        const roomMember = mkRoomMember(room.roomId, userId, membership, isKicked, { membership: prevMembership });
        vi.spyOn(room, "getMember").mockReturnValue(roomMember);
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
            getMember: vi.fn().mockImplementation((userId) => {
                return userId === STUB_MEMBER_ID ? ({} as RoomMember) : null;
            }),
        };
        vi.mocked(client.getRoom).mockImplementation((roomId) => {
            return roomId === STUB_ROOM_ID ? (stubRoom as unknown as Room) : null;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("resolves with false if the timeout is reached", async () => {
        const result = await waitForMember(client, "", "", { timeout: 0 });
        expect(result).toBe(false);
    });

    it("resolves with false if the timeout is reached, even if other RoomState.newMember events fire", async () => {
        vi.useFakeTimers();
        const roomId = "!roomId:domain";
        const userId = "@clientId:domain";
        const resultProm = waitForMember(client, roomId, userId, { timeout });
        vi.advanceTimersByTime(50);
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
        vi.useRealTimers();
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
        vi.useFakeTimers();
        const resultProm = waitForMember(client, STUB_ROOM_ID, STUB_MEMBER_ID, { timeout });
        expect(await resultProm).toBe(true);
    });

    it("waits for the timeout if the room is known but the user is not", async () => {
        const result = await waitForMember(client, STUB_ROOM_ID, "@other_user", { timeout: 0 });
        expect(result).toBe(false);
    });
});
