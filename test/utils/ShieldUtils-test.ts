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

import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import { shieldStatusForRoom } from "../../src/utils/ShieldUtils";
import DMRoomMap from "../../src/utils/DMRoomMap";

function mkClient(selfTrust = false) {
    return {
        getUserId: () => "@self:localhost",
        getCrypto: () => ({
            getDeviceVerificationStatus: (userId: string, deviceId: string) =>
                Promise.resolve({
                    isVerified: () => (userId === "@self:localhost" ? selfTrust : userId[2] == "T"),
                }),
            getUserDeviceInfo: async (userIds: string[]) => {
                return new Map(userIds.map((u) => [u, new Map([["DEVICE", {}]])]));
            },
        }),
        checkUserTrust: (userId: string) => ({
            isCrossSigningVerified: () => userId[1] == "T",
            wasCrossSigningVerified: () => userId[1] == "T" || userId[1] == "W",
        }),
    } as unknown as MatrixClient;
}

describe("mkClient self-test", function () {
    test.each([true, false])("behaves well for self-trust=%s", async (v) => {
        const client = mkClient(v);
        const status = await client.getCrypto()!.getDeviceVerificationStatus("@self:localhost", "DEVICE");
        expect(status?.isVerified()).toBe(v);
    });

    test.each([
        ["@TT:h", true],
        ["@TF:h", true],
        ["@FT:h", false],
        ["@FF:h", false],
    ])("behaves well for user trust %s", (userId, trust) => {
        expect(mkClient().checkUserTrust(userId).isCrossSigningVerified()).toBe(trust);
    });

    test.each([
        ["@TT:h", true],
        ["@TF:h", false],
        ["@FT:h", true],
        ["@FF:h", false],
    ])("behaves well for device trust %s", async (userId, trust) => {
        const status = await mkClient().getCrypto()!.getDeviceVerificationStatus(userId, "device");
        expect(status?.isVerified()).toBe(trust);
    });
});

describe("shieldStatusForMembership self-trust behaviour", function () {
    beforeAll(() => {
        const mockInstance = {
            getUserIdForRoomId: (roomId: string) => (roomId === "DM" ? "@any:h" : null),
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(mockInstance);
    });

    afterAll(() => {
        jest.spyOn(DMRoomMap, "shared").mockRestore();
    });

    it.each([
        [true, true],
        [true, false],
        [false, true],
        [false, false],
    ])("2 unverified: returns 'normal', self-trust = %s, DM = %s", async (trusted, dm) => {
        const client = mkClient(trusted);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@FF1:h", "@FF2:h"].map((userId) => ({ userId })),
        } as unknown as Room;
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual("normal");
    });

    it.each([
        ["verified", true, true],
        ["verified", true, false],
        ["verified", false, true],
        ["warning", false, false],
    ])("2 verified: returns '%s', self-trust = %s, DM = %s", async (result, trusted, dm) => {
        const client = mkClient(trusted);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@TT1:h", "@TT2:h"].map((userId) => ({ userId })),
        } as unknown as Room;
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each([
        ["normal", true, true],
        ["normal", true, false],
        ["normal", false, true],
        ["warning", false, false],
    ])("2 mixed: returns '%s', self-trust = %s, DM = %s", async (result, trusted, dm) => {
        const client = mkClient(trusted);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@TT1:h", "@FF2:h"].map((userId) => ({ userId })),
        } as unknown as Room;
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each([
        ["verified", true, true],
        ["verified", true, false],
        ["warning", false, true],
        ["warning", false, false],
    ])("0 others: returns '%s', self-trust = %s, DM = %s", async (result, trusted, dm) => {
        const client = mkClient(trusted);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost"].map((userId) => ({ userId })),
        } as unknown as Room;
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each([
        ["verified", true, true],
        ["verified", true, false],
        ["verified", false, true],
        ["verified", false, false],
    ])("1 verified: returns '%s', self-trust = %s, DM = %s", async (result, trusted, dm) => {
        const client = mkClient(trusted);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@TT:h"].map((userId) => ({ userId })),
        } as unknown as Room;
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each([
        ["normal", true, true],
        ["normal", true, false],
        ["normal", false, true],
        ["normal", false, false],
    ])("1 unverified: returns '%s', self-trust = %s, DM = %s", async (result, trusted, dm) => {
        const client = mkClient(trusted);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@FF:h"].map((userId) => ({ userId })),
        } as unknown as Room;
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });
});

describe("shieldStatusForMembership other-trust behaviour", function () {
    beforeAll(() => {
        const mockInstance = {
            getUserIdForRoomId: (roomId: string) => (roomId === "DM" ? "@any:h" : null),
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(mockInstance);
    });

    it.each([
        ["warning", true],
        ["warning", false],
    ])("1 verified/untrusted: returns '%s', DM = %s", async (result, dm) => {
        const client = mkClient(true);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@TF:h"].map((userId) => ({ userId })),
        } as unknown as Room;
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each([
        ["warning", true],
        ["warning", false],
    ])("2 verified/untrusted: returns '%s', DM = %s", async (result, dm) => {
        const client = mkClient(true);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@TF:h", "@TT:h"].map((userId) => ({ userId })),
        } as unknown as Room;
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each([
        ["normal", true],
        ["normal", false],
    ])("2 unverified/untrusted: returns '%s', DM = %s", async (result, dm) => {
        const client = mkClient(true);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@FF:h", "@FT:h"].map((userId) => ({ userId })),
        } as unknown as Room;
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each([
        ["warning", true],
        ["warning", false],
    ])("2 was verified: returns '%s', DM = %s", async (result, dm) => {
        const client = mkClient(true);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@WF:h", "@FT:h"].map((userId) => ({ userId })),
        } as unknown as Room;
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });
});
