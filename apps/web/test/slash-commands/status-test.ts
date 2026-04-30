/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { stubClient } from "../test-utils";
import { statusCommand } from "../../src/slash-commands/status";
import { UserFriendlyError } from "../../src/languageHandler";

describe("/status", () => {
    const roomId = "!room:example.com";

    let client: ReturnType<typeof stubClient>;

    beforeEach(() => {
        client = stubClient();
        client.setExtendedProfileProperty = jest.fn().mockResolvedValue(undefined);
    });

    function run(args?: string) {
        return statusCommand.run(client, roomId, null, args);
    }

    it("should reject if no args provided", () => {
        const result = run(undefined);
        expect(result.error).toBeInstanceOf(UserFriendlyError);
        expect((result.error as UserFriendlyError).message).toBe(
            "No arguments provided. You should supply an emoij and an optional text component.",
        );
    });

    it("should reject if no text is provided after the emoji", () => {
        const result = run("🎉");
        expect(result.error).toBeInstanceOf(UserFriendlyError);
        expect((result.error as UserFriendlyError).message).toBe("You did not provide any status text");
    });

    it("should reject if the emoji field has more than one grapheme segment", () => {
        const result = run("ab hello");
        expect(result.error).toBeInstanceOf(UserFriendlyError);
        expect((result.error as UserFriendlyError).message).toBe("The first argument must be an emoji");
    });

    it("should reject if the status text exceeds the maximum byte length", () => {
        const longText = "a".repeat(257);
        const result = run(`🎉 ${longText}`);
        expect(result.error).toBeInstanceOf(UserFriendlyError);
        expect((result.error as UserFriendlyError).message).toBe("The text you provided was too long.");
    });

    it("should set the extended profile property on success", async () => {
        const result = run("🎉 Having a great day");
        expect(result.error).toBeUndefined();
        await result.promise;
        expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.status", {
            emoji: "🎉",
            text: "Having a great day",
        });
    });
});
