/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { EventType, type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { LocalRoom, LOCAL_ROOM_ID_PREFIX } from "../../../../src/models/LocalRoom";
import { DirectoryMember } from "../../../../src/utils/direct-messages";
import { isRoomReady } from "../../../../src/utils/localRoom/isRoomReady";
import { createTestClient, makeMembershipEvent, mkEvent } from "../../../test-utils";

describe("isRoomReady", () => {
    const userId1 = "@user1:example.com";
    const member1 = new DirectoryMember({ user_id: userId1 });
    const userId2 = "@user2:example.com";
    let room1: Room;
    let localRoom: LocalRoom;
    let client: MatrixClient;

    beforeEach(() => {
        client = createTestClient();
        room1 = new Room("!room1:example.com", client, userId1);
        room1.getMyMembership = () => KnownMembership.Join;
        localRoom = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test", client, "@test:example.com");
    });

    beforeEach(() => {
        localRoom.targets = [member1];
    });

    it("should return false if the room has no actual room id", () => {
        expect(isRoomReady(client, localRoom)).toBe(false);
    });

    describe("for a room with an actual room id", () => {
        beforeEach(() => {
            localRoom.actualRoomId = room1.roomId;
            mocked(client.getRoom).mockReturnValue(null);
        });

        it("should return false", () => {
            expect(isRoomReady(client, localRoom)).toBe(false);
        });

        describe("and the room is known to the client", () => {
            beforeEach(() => {
                mocked(client.getRoom).mockImplementation((roomId: string) => {
                    if (roomId === room1.roomId) return room1;
                    return null;
                });
            });

            it("should return false", () => {
                expect(isRoomReady(client, localRoom)).toBe(false);
            });

            describe("and all members have been invited or joined", () => {
                beforeEach(() => {
                    room1.currentState.setStateEvents([
                        makeMembershipEvent(room1.roomId, userId1, KnownMembership.Join),
                        makeMembershipEvent(room1.roomId, userId2, KnownMembership.Invite),
                    ]);
                });

                it("should return false", () => {
                    expect(isRoomReady(client, localRoom)).toBe(false);
                });

                describe("and a RoomHistoryVisibility event", () => {
                    beforeEach(() => {
                        room1.currentState.setStateEvents([
                            mkEvent({
                                user: userId1,
                                event: true,
                                type: EventType.RoomHistoryVisibility,
                                room: room1.roomId,
                                content: {},
                            }),
                        ]);
                    });

                    it("should return true", () => {
                        expect(isRoomReady(client, localRoom)).toBe(true);
                    });

                    describe("and an encrypted room", () => {
                        beforeEach(() => {
                            localRoom.encrypted = true;
                        });

                        it("should return false", () => {
                            expect(isRoomReady(client, localRoom)).toBe(false);
                        });

                        describe("and a room encryption state event", () => {
                            beforeEach(() => {
                                room1.currentState.setStateEvents([
                                    mkEvent({
                                        user: userId1,
                                        event: true,
                                        type: EventType.RoomEncryption,
                                        room: room1.roomId,
                                        content: {},
                                    }),
                                ]);
                            });

                            it("should return true", () => {
                                expect(isRoomReady(client, localRoom)).toBe(true);
                            });
                        });
                    });
                });
            });
        });
    });
});
