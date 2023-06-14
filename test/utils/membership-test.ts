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

import { EventEmitter } from "events";
import { MatrixClient, RoomStateEvent } from "matrix-js-sdk/src/matrix";

import { waitForMember } from "../../src/utils/membership";

/* Shorter timeout, we've got tests to run */
const timeout = 30;

describe("waitForMember", () => {
    let client: EventEmitter;

    beforeEach(() => {
        client = new EventEmitter();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("resolves with false if the timeout is reached", async () => {
        const result = await waitForMember(<MatrixClient>client, "", "", { timeout: 0 });
        expect(result).toBe(false);
    });

    it("resolves with false if the timeout is reached, even if other RoomState.newMember events fire", async () => {
        jest.useFakeTimers();
        const roomId = "!roomId:domain";
        const userId = "@clientId:domain";
        const resultProm = waitForMember(<MatrixClient>client, roomId, userId, { timeout });
        jest.advanceTimersByTime(50);
        expect(await resultProm).toBe(false);
        client.emit("RoomState.newMember", undefined, undefined, { roomId, userId: "@anotherClient:domain" });
        jest.useRealTimers();
    });

    it("resolves with true if RoomState.newMember fires", async () => {
        const roomId = "!roomId:domain";
        const userId = "@clientId:domain";
        expect((<MatrixClient>client).listeners(RoomStateEvent.NewMember).length).toBe(0);
        const resultProm = waitForMember(<MatrixClient>client, roomId, userId, { timeout });
        client.emit("RoomState.newMember", undefined, undefined, { roomId, userId });
        expect(await resultProm).toBe(true);
    });
});
