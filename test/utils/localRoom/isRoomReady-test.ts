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

import { mocked } from "jest-mock";
import { EventType, MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import { LocalRoom, LOCAL_ROOM_ID_PREFIX } from "../../../src/models/LocalRoom";
import { DirectoryMember } from "../../../src/utils/direct-messages";
import { isRoomReady } from "../../../src/utils/localRoom/isRoomReady";
import { createTestClient, makeMembershipEvent, mkEvent } from "../../test-utils";

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
        room1.getMyMembership = () => "join";
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
                        makeMembershipEvent(room1.roomId, userId1, "join"),
                        makeMembershipEvent(room1.roomId, userId2, "invite"),
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
