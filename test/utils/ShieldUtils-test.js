import { shieldStatusForRoom } from '../../src/utils/ShieldUtils';
import DMRoomMap from '../../src/utils/DMRoomMap';

function mkClient(selfTrust) {
    return {
        getUserId: () => "@self:localhost",
        checkUserTrust: (userId) => ({
            isCrossSigningVerified: () => userId[1] == "T",
            wasCrossSigningVerified: () => userId[1] == "T" || userId[1] == "W",
        }),
        checkDeviceTrust: (userId, deviceId) => ({
            isVerified: () => userId === "@self:localhost" ? selfTrust : userId[2] == "T",
        }),
        getStoredDevicesForUser: (userId) => ["DEVICE"],
    };
}

describe("mkClient self-test", function() {
    test.each([true, false])("behaves well for self-trust=%s", (v) => {
        const client = mkClient(v);
        expect(client.checkDeviceTrust("@self:localhost", "DEVICE").isVerified()).toBe(v);
    });

    test.each([
        ["@TT:h", true],
        ["@TF:h", true],
        ["@FT:h", false],
        ["@FF:h", false]],
        )("behaves well for user trust %s", (userId, trust) => {
        expect(mkClient().checkUserTrust(userId).isCrossSigningVerified()).toBe(trust);
    });

    test.each([
        ["@TT:h", true],
        ["@TF:h", false],
        ["@FT:h", true],
        ["@FF:h", false]],
        )("behaves well for device trust %s", (userId, trust) => {
        expect(mkClient().checkDeviceTrust(userId, "device").isVerified()).toBe(trust);
    });
});

describe("shieldStatusForMembership self-trust behaviour", function() {
    beforeAll(() => {
        DMRoomMap._sharedInstance = {
            getUserIdForRoomId: (roomId) => roomId === "DM" ? "@any:h" : null,
        };
    });

    it.each(
        [[true, true], [true, false],
        [false, true], [false, false]],
    )("2 unverified: returns 'normal', self-trust = %s, DM = %s", async (trusted, dm) => {
        const client = mkClient(trusted);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@FF1:h", "@FF2:h"].map((userId) => ({userId})),
        };
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual("normal");
    });

    it.each(
        [["verified", true, true], ["verified", true, false],
        ["verified", false, true], ["warning", false, false]],
    )("2 verified: returns '%s', self-trust = %s, DM = %s", async (result, trusted, dm) => {
        const client = mkClient(trusted);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@TT1:h", "@TT2:h"].map((userId) => ({userId})),
        };
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each(
        [["normal", true, true], ["normal", true, false],
        ["normal", false, true], ["warning", false, false]],
    )("2 mixed: returns '%s', self-trust = %s, DM = %s", async (result, trusted, dm) => {
        const client = mkClient(trusted);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@TT1:h", "@FF2:h"].map((userId) => ({userId})),
        };
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each(
        [["verified", true, true], ["verified", true, false],
        ["warning", false, true], ["warning", false, false]],
    )("0 others: returns '%s', self-trust = %s, DM = %s", async (result, trusted, dm) => {
        const client = mkClient(trusted);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost"].map((userId) => ({userId})),
        };
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each(
        [["verified", true, true], ["verified", true, false],
        ["verified", false, true], ["verified", false, false]],
    )("1 verified: returns '%s', self-trust = %s, DM = %s", async (result, trusted, dm) => {
        const client = mkClient(trusted);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@TT:h"].map((userId) => ({userId})),
        };
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each(
        [["normal", true, true], ["normal", true, false],
        ["normal", false, true], ["normal", false, false]],
    )("1 unverified: returns '%s', self-trust = %s, DM = %s", async (result, trusted, dm) => {
        const client = mkClient(trusted);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@FF:h"].map((userId) => ({userId})),
        };
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });
});

describe("shieldStatusForMembership other-trust behaviour", function() {
    beforeAll(() => {
        DMRoomMap._sharedInstance = {
            getUserIdForRoomId: (roomId) => roomId === "DM" ? "@any:h" : null,
        };
    });

    it.each(
        [["warning", true], ["warning", false]],
    )("1 verified/untrusted: returns '%s', DM = %s", async (result, dm) => {
        const client = mkClient(true);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@TF:h"].map((userId) => ({userId})),
        };
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each(
        [["warning", true], ["warning", false]],
    )("2 verified/untrusted: returns '%s', DM = %s", async (result, dm) => {
        const client = mkClient(true);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@TF:h", "@TT:h"].map((userId) => ({userId})),
        };
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each(
        [["normal", true], ["normal", false]],
    )("2 unverified/untrusted: returns '%s', DM = %s", async (result, dm) => {
        const client = mkClient(true);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@FF:h", "@FT:h"].map((userId) => ({userId})),
        };
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });

    it.each(
        [["warning", true], ["warning", false]],
    )("2 was verified: returns '%s', DM = %s", async (result, dm) => {
        const client = mkClient(true);
        const room = {
            roomId: dm ? "DM" : "other",
            getEncryptionTargetMembers: () => ["@self:localhost", "@WF:h", "@FT:h"].map((userId) => ({userId})),
        };
        const status = await shieldStatusForRoom(client, room);
        expect(status).toEqual(result);
    });
});
