/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked, type Mocked } from "jest-mock";
import { logger } from "matrix-js-sdk/src/logger";
import {
    ClientEvent,
    EventType,
    type IContent,
    type MatrixClient,
    type MatrixEvent,
    type Room,
} from "matrix-js-sdk/src/matrix";

import DMRoomMap from "../../../src/utils/DMRoomMap";
import { mkEvent, stubClient } from "../../test-utils";
describe("DMRoomMap", () => {
    const roomId1 = "!room1:example.com";
    const roomId2 = "!room2:example.com";
    const roomId3 = "!room3:example.com";
    const roomId4 = "!room4:example.com";

    const validMDirectContent = {
        "user@example.com": [roomId1, roomId2],
        "@user:example.com": [roomId1, roomId3, roomId4],
        "@user2:example.com": [] as string[],
    } as IContent;

    let client: Mocked<MatrixClient>;
    let dmRoomMap: DMRoomMap;

    const mkMDirectEvent = (content: any): MatrixEvent => {
        return mkEvent({
            event: true,
            type: EventType.Direct,
            user: client.getSafeUserId(),
            content: content,
        });
    };

    beforeEach(() => {
        client = mocked(stubClient());
        jest.spyOn(logger, "warn");
    });

    describe("when m.direct has valid content", () => {
        beforeEach(() => {
            client.getAccountData.mockReturnValue(mkMDirectEvent(validMDirectContent));
            dmRoomMap = new DMRoomMap(client);
            dmRoomMap.start();
        });

        it("getRoomIds should return the room Ids", () => {
            expect(dmRoomMap.getRoomIds()).toEqual(new Set([roomId1, roomId2, roomId3, roomId4]));
        });

        describe("and there is an update with valid data", () => {
            beforeEach(() => {
                client.emit(
                    ClientEvent.AccountData,
                    mkMDirectEvent({
                        "@user:example.com": [roomId1, roomId3],
                    }),
                );
            });

            it("getRoomIds should return the new room Ids", () => {
                expect(dmRoomMap.getRoomIds()).toEqual(new Set([roomId1, roomId3]));
            });
        });

        describe("and there is an update with invalid data", () => {
            const partiallyInvalidContent = {
                "@user1:example.com": [roomId1, roomId3],
                "@user2:example.com": "room2, room3",
            };

            beforeEach(() => {
                client.emit(ClientEvent.AccountData, mkMDirectEvent(partiallyInvalidContent));
            });

            it("getRoomIds should return the valid room Ids", () => {
                expect(dmRoomMap.getRoomIds()).toEqual(new Set([roomId1, roomId3]));
            });

            it("should log the invalid content", () => {
                expect(logger.warn).toHaveBeenCalledWith("Invalid m.direct content occurred", partiallyInvalidContent);
            });
        });
    });

    describe("when m.direct content contains the entire event", () => {
        const mDirectContentContent = {
            type: EventType.Direct,
            content: validMDirectContent,
        };

        beforeEach(() => {
            client.getAccountData.mockReturnValue(mkMDirectEvent(mDirectContentContent));
            dmRoomMap = new DMRoomMap(client);
        });

        it("should log the invalid content", () => {
            expect(logger.warn).toHaveBeenCalledWith("Invalid m.direct content occurred", mDirectContentContent);
        });

        it("getRoomIds should return an empty list", () => {
            expect(dmRoomMap.getRoomIds()).toEqual(new Set([]));
        });
    });

    describe("when partially crap m.direct content appears", () => {
        const partiallyCrapContent = {
            "hello": 23,
            "@user1:example.com": [] as string[],
            "@user2:example.com": [roomId1, roomId2],
            "@user3:example.com": "room1, room2, room3",
            "@user4:example.com": [roomId4],
        };

        beforeEach(() => {
            client.getAccountData.mockReturnValue(mkMDirectEvent(partiallyCrapContent));
            dmRoomMap = new DMRoomMap(client);
        });

        it("should log the invalid content", () => {
            expect(logger.warn).toHaveBeenCalledWith("Invalid m.direct content occurred", partiallyCrapContent);
        });

        it("getRoomIds should only return the valid items", () => {
            expect(dmRoomMap.getRoomIds()).toEqual(new Set([roomId1, roomId2, roomId4]));
        });
    });

    describe("getUniqueRoomsWithIndividuals()", () => {
        const bigRoom = {
            roomId: "!bigRoom:server.org",
            getInvitedAndJoinedMemberCount: jest.fn().mockReturnValue(5000),
        } as unknown as Room;
        const dmWithBob = {
            roomId: "!dmWithBob:server.org",
            getInvitedAndJoinedMemberCount: jest.fn().mockReturnValue(2),
        } as unknown as Room;
        const dmWithCharlie = {
            roomId: "!dmWithCharlie:server.org",
            getInvitedAndJoinedMemberCount: jest.fn().mockReturnValue(2),
        } as unknown as Room;
        const smallRoom = {
            roomId: "!smallRoom:server.org",
            getInvitedAndJoinedMemberCount: jest.fn().mockReturnValue(3),
        } as unknown as Room;

        const mDirectContent = {
            "@bob:server.org": [bigRoom.roomId, dmWithBob.roomId, smallRoom.roomId],
            "@charlie:server.org": [dmWithCharlie.roomId, smallRoom.roomId],
        };

        beforeEach(() => {
            client.getAccountData.mockReturnValue(mkMDirectEvent(mDirectContent));
            client.getRoom.mockImplementation(
                (roomId: string) =>
                    [bigRoom, smallRoom, dmWithCharlie, dmWithBob].find((room) => room.roomId === roomId) ?? null,
            );
        });

        it("returns an empty object when room map has not been populated", () => {
            const instance = new DMRoomMap(client);
            expect(instance.getUniqueRoomsWithIndividuals()).toEqual({});
        });

        it("returns map of users to rooms with 2 members", () => {
            const dmRoomMap = new DMRoomMap(client);
            dmRoomMap.start();
            expect(dmRoomMap.getUniqueRoomsWithIndividuals()).toEqual({
                "@bob:server.org": dmWithBob,
                "@charlie:server.org": dmWithCharlie,
            });
        });

        it("excludes rooms that are not found by matrixClient", () => {
            client.getRoom.mockReset().mockReturnValue(null);
            const dmRoomMap = new DMRoomMap(client);
            dmRoomMap.start();
            expect(dmRoomMap.getUniqueRoomsWithIndividuals()).toEqual({});
        });
    });
});
