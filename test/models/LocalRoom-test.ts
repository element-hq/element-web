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

import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { LocalRoom, LocalRoomState, LOCAL_ROOM_ID_PREFIX } from "../../src/models/LocalRoom";
import { createTestClient } from "../test-utils";

const stateTestData = [
    {
        name: "NEW",
        state: LocalRoomState.NEW,
        isNew: true,
        isCreated: false,
        isError: false,
    },
    {
        name: "CREATING",
        state: LocalRoomState.CREATING,
        isNew: false,
        isCreated: false,
        isError: false,
    },
    {
        name: "CREATED",
        state: LocalRoomState.CREATED,
        isNew: false,
        isCreated: true,
        isError: false,
    },
    {
        name: "ERROR",
        state: LocalRoomState.ERROR,
        isNew: false,
        isCreated: false,
        isError: true,
    },
];

describe("LocalRoom", () => {
    let room: LocalRoom;
    let client: MatrixClient;

    beforeEach(() => {
        client = createTestClient();
        room = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test", client, "@test:localhost");
    });

    it("should not raise an error on getPendingEvents (implicitly check for pendingEventOrdering: detached)", () => {
        room.getPendingEvents();
        expect(true).toBe(true);
    });

    it("should not have after create callbacks", () => {
        expect(room.afterCreateCallbacks).toHaveLength(0);
    });

    stateTestData.forEach((stateTestDatum) => {
        describe(`in state ${stateTestDatum.name}`, () => {
            beforeEach(() => {
                room.state = stateTestDatum.state;
            });

            it(`isNew should return ${stateTestDatum.isNew}`, () => {
                expect(room.isNew).toBe(stateTestDatum.isNew);
            });

            it(`isCreated should return ${stateTestDatum.isCreated}`, () => {
                expect(room.isCreated).toBe(stateTestDatum.isCreated);
            });

            it(`isError should return ${stateTestDatum.isError}`, () => {
                expect(room.isError).toBe(stateTestDatum.isError);
            });
        });
    });
});
