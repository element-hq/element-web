/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import { type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import {
    clearAllUserStatus,
    fetchUserStatus,
    setUserOnCall,
    setUserStatus,
    userStatusTextWithinMaxLength,
} from "./userStatus";

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
            client.doesServerSupportExtendedProfiles = vi.fn();
        });

        it("returns undefined if the server does not support extended profiles", async () => {
            vi.mocked(client.doesServerSupportExtendedProfiles).mockResolvedValue(false);

            await expect(fetchUserStatus(client, "@alice:example.com")).resolves.toBeUndefined();
            expect(client.getExtendedProfileProperty).not.toHaveBeenCalled();
        });

        it("returns the validated status if the server supports extended profiles and has a status set", async () => {
            vi.mocked(client.doesServerSupportExtendedProfiles).mockResolvedValue(true);
            vi.mocked(client.getExtendedProfileProperty).mockResolvedValue({
                emoji: "🐳",
                text: "Feeling a little blue",
            });

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
            vi.mocked(client.doesServerSupportExtendedProfiles).mockResolvedValue(true);
            vi.mocked(client.getExtendedProfileProperty).mockResolvedValue({ text: "Feeling a little blue" });

            await expect(fetchUserStatus(client, "@alice:example.com")).resolves.toBeUndefined();
        });

        it("returns undefined if the user has no status set", async () => {
            vi.mocked(client.doesServerSupportExtendedProfiles).mockResolvedValue(true);
            vi.mocked(client.getExtendedProfileProperty).mockRejectedValue(
                new MatrixError({ errcode: "M_NOT_FOUND" }, 404),
            );

            await expect(fetchUserStatus(client, "@alice:example.com")).resolves.toBeUndefined();
        });

        it("returns undefined and logs a warning if fetching the status fails unexpectedly", async () => {
            vi.mocked(client.doesServerSupportExtendedProfiles).mockResolvedValue(true);
            const error = new Error("network error");
            vi.mocked(client.getExtendedProfileProperty).mockRejectedValue(error);

            await expect(fetchUserStatus(client, "@alice:example.com")).resolves.toBeUndefined();
        });
    });

    describe("clearAllUserStatus", () => {
        let client: MatrixClient;

        beforeEach(() => {
            client = stubClient();
        });

        it("clears the user status", async () => {
            vi.mocked(client.getExtendedProfileProperty).mockResolvedValue({ emoji: "🍩", text: "Arbitrary Status" });

            await clearAllUserStatus(client);

            expect(client.deleteExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.status");
        });

        it("clears the call status", async () => {
            vi.mocked(client.getExtendedProfileProperty).mockResolvedValue({ call_joined_ts: 12345 });

            await clearAllUserStatus(client);

            expect(client.deleteExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.call");
        });
    });

    describe("setUserOnCall", () => {
        let client: MatrixClient;

        beforeEach(() => {
            client = stubClient();
        });

        it("sets the call status with the current time if onCall is true", async () => {
            vi.useFakeTimers().setSystemTime(12345);

            await setUserOnCall(client, true);

            expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.call", {
                call_joined_ts: 12345,
            });

            vi.useRealTimers();
        });

        it("clears the call status if onCall is false", async () => {
            await setUserOnCall(client, false);

            expect(client.deleteExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.call");
        });
    });
});
