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

import { waitForMember } from "../../src/utils/membership";

/* Shorter timeout, we've got tests to run */
const timeout = 30;

describe("waitForMember", () => {
    let client;

    beforeEach(() => {
        client = new EventEmitter();
    });

    it("resolves with false if the timeout is reached", (done) => {
        waitForMember(client, "", "", { timeout: 0 }).then((r) => {
            expect(r).toBe(false);
            done();
        });
    });

    it("resolves with false if the timeout is reached, even if other RoomState.newMember events fire", (done) => {
        const roomId = "!roomId:domain";
        const userId = "@clientId:domain";
        waitForMember(client, roomId, userId, { timeout }).then((r) => {
            expect(r).toBe(false);
            done();
        });
        client.emit("RoomState.newMember", undefined, undefined, { roomId, userId: "@anotherClient:domain" });
    });

    it("resolves with true if RoomState.newMember fires", (done) => {
        const roomId = "!roomId:domain";
        const userId = "@clientId:domain";
        waitForMember(client, roomId, userId, { timeout }).then((r) => {
            expect(r).toBe(true);
            expect(client.listeners("RoomState.newMember").length).toBe(0);
            done();
        });
        client.emit("RoomState.newMember", undefined, undefined, { roomId, userId });
    });
});
