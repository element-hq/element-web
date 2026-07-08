/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import {
    clearUserStatus,
    fetchUserStatus,
    setUserStatus,
    userStatusTextWithinMaxLength,
} from "../../../src/utils/userStatus";
import { stubClient } from "../../test-utils";

describe("userStatus utils", () => {
    describe("userStatusTextWithinMaxLength", () => {
        it("returns true for text within the max length", () => {
            const text = "a".repeat(256);
            expect(userStatusTextWithinMaxLength(text)).toBe(true);
        });
        it("returns false for text exceeding the max length", () => {
            const text = "a".repeat(257);
            expect(userStatusTextWithinMaxLength(text)).toBe(false);
        });
    });

    describe("setUserStatus", () => {
        let client: MatrixClient;

        beforeEach(() => {
            client = stubClient();
        });

        it("sets the user status with valid input", async () => {
            setUserStatus(client, { emoji: "🐳", text: "Feeling a little blue" });

            expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.status", {
                emoji: "🐳",
                text: "Feeling a little blue",
            });
        });
    });

    describe("fetchUserStatus", () => {
        let client: MatrixClient;

        beforeEach(() => {
            client = stubClient();
            client.doesServerSupportExtendedProfiles = jest.fn();
        });

        it("returns undefined if the server does not support extended profiles", async () => {
            mocked(client.doesServerSupportExtendedProfiles).mockResolvedValue(false);

            await expect(fetchUserStatus(client, "@alice:example.com")).resolves.toBeUndefined();
            expect(client.getExtendedProfileProperty).not.toHaveBeenCalled();
        });

        it("returns the validated status if the server supports extended profiles and has a status set", async () => {
            mocked(client.doesServerSupportExtendedProfiles).mockResolvedValue(true);
            mocked(client.getExtendedProfileProperty).mockResolvedValue({ emoji: "🐳", text: "Feeling a little blue" });

            await expect(fetchUserStatus(client, "@alice:example.com")).resolves.toEqual({
                emoji: "🐳",
                text: "Feeling a little blue",
            });
            expect(client.getExtendedProfileProperty).toHaveBeenCalledWith(
                "@alice:example.com",
                "org.matrix.msc4426.status",
            );
        });

        it("returns undefined if the status is invalid", async () => {
            mocked(client.doesServerSupportExtendedProfiles).mockResolvedValue(true);
            mocked(client.getExtendedProfileProperty).mockResolvedValue({ text: "Feeling a little blue" });

            await expect(fetchUserStatus(client, "@alice:example.com")).resolves.toBeUndefined();
        });

        it("returns undefined if the user has no status set", async () => {
            mocked(client.doesServerSupportExtendedProfiles).mockResolvedValue(true);
            mocked(client.getExtendedProfileProperty).mockRejectedValue(
                new MatrixError({ errcode: "M_NOT_FOUND" }, 404),
            );

            await expect(fetchUserStatus(client, "@alice:example.com")).resolves.toBeUndefined();
        });

        it("returns undefined and logs a warning if fetching the status fails unexpectedly", async () => {
            mocked(client.doesServerSupportExtendedProfiles).mockResolvedValue(true);
            const error = new Error("network error");
            mocked(client.getExtendedProfileProperty).mockRejectedValue(error);

            await expect(fetchUserStatus(client, "@alice:example.com")).resolves.toBeUndefined();
        });
    });

    describe("clearUserStatus", () => {
        let client: MatrixClient;

        beforeEach(() => {
            client = stubClient();
        });

        it("clears the user status", async () => {
            clearUserStatus(client);

            expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.status", null);
        });
    });
});
