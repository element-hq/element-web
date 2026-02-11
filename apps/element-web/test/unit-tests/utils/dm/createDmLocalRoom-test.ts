/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { EventType, KNOWN_SAFE_ROOM_VERSION, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { canEncryptToAllUsers } from "../../../../src/createRoom";
import { type LocalRoom, LOCAL_ROOM_ID_PREFIX } from "../../../../src/models/LocalRoom";
import { DirectoryMember, type Member, ThreepidMember } from "../../../../src/utils/direct-messages";
import { createDmLocalRoom } from "../../../../src/utils/dm/createDmLocalRoom";
import { privateShouldBeEncrypted } from "../../../../src/utils/rooms";
import { createTestClient } from "../../../test-utils";

jest.mock("../../../../src/utils/rooms", () => ({
    privateShouldBeEncrypted: jest.fn(),
}));

jest.mock("../../../../src/createRoom", () => ({
    canEncryptToAllUsers: jest.fn(),
}));

function assertLocalRoom(room: LocalRoom, targets: Member[], encrypted: boolean) {
    expect(room.roomId).toBe(LOCAL_ROOM_ID_PREFIX + "t1");
    expect(room.name).toBe(targets.length ? targets[0].name : "Empty Room");
    expect(room.encrypted).toBe(encrypted);
    expect(room.targets).toEqual(targets);
    expect(room.getMyMembership()).toBe(KnownMembership.Join);

    const roomCreateEvent = room.currentState.getStateEvents(EventType.RoomCreate)[0];
    expect(roomCreateEvent).toBeDefined();
    expect(roomCreateEvent.getContent()["room_version"]).toBe(KNOWN_SAFE_ROOM_VERSION);

    // check that the user and all targets are joined
    expect(room.getMember("@userId:matrix.org")?.membership).toBe(KnownMembership.Join);
    targets.forEach((target: Member) => {
        expect(room.getMember(target.userId)?.membership).toBe(KnownMembership.Join);
    });

    if (encrypted) {
        const encryptionEvent = room.currentState.getStateEvents(EventType.RoomEncryption)[0];
        expect(encryptionEvent).toBeDefined();
    }
}

describe("createDmLocalRoom", () => {
    let mockClient: MatrixClient;
    const userId1 = "@user1:example.com";
    const member1 = new DirectoryMember({ user_id: userId1 });
    const member2 = new ThreepidMember("user2");

    beforeEach(() => {
        mockClient = createTestClient();
    });

    describe("when rooms should be encrypted", () => {
        beforeEach(() => {
            mocked(privateShouldBeEncrypted).mockReturnValue(true);
        });

        it("should create an encrytped room for 3PID targets", async () => {
            const room = await createDmLocalRoom(mockClient, [member2]);
            expect(mockClient.store.storeRoom).toHaveBeenCalledWith(room);
            assertLocalRoom(room, [member2], true);
        });

        describe("for MXID targets with encryption available", () => {
            beforeEach(() => {
                mocked(canEncryptToAllUsers).mockResolvedValue(true);
            });

            it("should create an encrypted room", async () => {
                const room = await createDmLocalRoom(mockClient, [member1]);
                expect(mockClient.store.storeRoom).toHaveBeenCalledWith(room);
                assertLocalRoom(room, [member1], true);
            });
        });

        describe("for MXID targets with encryption unavailable", () => {
            beforeEach(() => {
                mocked(canEncryptToAllUsers).mockResolvedValue(false);
            });

            it("should create an unencrypted room", async () => {
                const room = await createDmLocalRoom(mockClient, [member1]);
                expect(mockClient.store.storeRoom).toHaveBeenCalledWith(room);
                assertLocalRoom(room, [member1], false);
            });
        });
    });

    describe("if rooms should not be encrypted", () => {
        beforeEach(() => {
            mocked(privateShouldBeEncrypted).mockReturnValue(false);
        });

        it("should create an unencrypted room", async () => {
            const room = await createDmLocalRoom(mockClient, [member1]);
            assertLocalRoom(room, [member1], false);
        });
    });
});
