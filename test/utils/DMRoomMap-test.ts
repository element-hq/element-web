/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { mocked, Mocked } from "jest-mock";
import { logger } from "matrix-js-sdk/src/logger";
import { ClientEvent, EventType, IContent, MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import DMRoomMap from "../../src/utils/DMRoomMap";
import { mkEvent, stubClient } from "../test-utils";
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
});
