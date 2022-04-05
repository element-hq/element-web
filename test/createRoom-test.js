import { canEncryptToAllUsers } from '../src/createRoom';

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

    it("returns true if all devices have crypto", async () => {
        const client = {
            downloadKeys: async function(userIds) { return trueUser; },
        };
        const response = await canEncryptToAllUsers(client, ["@goodUser:localhost"]);
        expect(response).toBe(true);
    });

    it("returns false if not all users have crypto", async () => {
        const client = {
            downloadKeys: async function(userIds) { return { ...trueUser, ...falseUser }; },
        };
        const response = await canEncryptToAllUsers(client, ["@goodUser:localhost", "@badUser:localhost"]);
        expect(response).toBe(false);
    });
});
