/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";

import { shieldStatusForRoom } from "../../../src/utils/ShieldUtils";
import DMRoomMap from "../../../src/utils/DMRoomMap";

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
            getUserVerificationStatus: async (userId: string): Promise<UserVerificationStatus> =>
                new UserVerificationStatus(userId[1] == "T", userId[1] == "T" || userId[1] == "W", false),
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
    ])("behaves well for user trust %s", async (userId, trust) => {
        const status = await mkClient().getCrypto()?.getUserVerificationStatus(userId);
        expect(status!.isCrossSigningVerified()).toBe(trust);
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
