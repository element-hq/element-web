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
import { EventType, IContent, MatrixClient } from "matrix-js-sdk/src/matrix";

import DMRoomMap from "../../src/utils/DMRoomMap";
import { mkEvent, stubClient } from "../test-utils";

describe("DMRoomMap", () => {
    const roomId1 = "!room1:example.com";
    const roomId2 = "!room2:example.com";
    const roomId3 = "!room3:example.com";
    const roomId4 = "!room4:example.com";

    const mDirectContent = {
        "user@example.com": [roomId1, roomId2],
        "@user:example.com": [roomId1, roomId3, roomId4],
        "@user2:example.com": [] as string[],
    } satisfies IContent;

    let client: Mocked<MatrixClient>;
    let dmRoomMap: DMRoomMap;

    beforeEach(() => {
        client = mocked(stubClient());

        const mDirectEvent = mkEvent({
            event: true,
            type: EventType.Direct,
            user: client.getSafeUserId(),
            content: mDirectContent,
        });
        client.getAccountData.mockReturnValue(mDirectEvent);
        dmRoomMap = new DMRoomMap(client);
    });

    it("getRoomIds should return the room Ids", () => {
        expect(dmRoomMap.getRoomIds()).toEqual(new Set([roomId1, roomId2, roomId3, roomId4]));
    });
});
