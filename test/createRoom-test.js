import './skinned-sdk'; // Must be first for skinning to work
import { EventEmitter } from 'events';

import { waitForMember, canEncryptToAllUsers } from '../src/createRoom';

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

describe("canEncryptToAllUsers", () => {
    const trueUser = {
        "@goodUser:localhost": {
            "DEV1": {},
            "DEV2": {},
        },
    };
    const falseUser = {
        "@badUser:localhost": {},
    };

    it("returns true if all devices have crypto", async (done) => {
        const client = {
            downloadKeys: async function(userIds) { return trueUser; },
        };
        const response = await canEncryptToAllUsers(client, ["@goodUser:localhost"]);
        expect(response).toBe(true);
        done();
    });

    it("returns false if not all users have crypto", async (done) => {
        const client = {
            downloadKeys: async function(userIds) { return { ...trueUser, ...falseUser }; },
        };
        const response = await canEncryptToAllUsers(client, ["@goodUser:localhost", "@badUser:localhost"]);
        expect(response).toBe(false);
        done();
    });
});
