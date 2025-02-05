/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { LocalRoom, LocalRoomState, LOCAL_ROOM_ID_PREFIX } from "../../../src/models/LocalRoom";
import { createTestClient } from "../../test-utils";

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
