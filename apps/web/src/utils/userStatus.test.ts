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
    clearUserStatus,
    fetchUserStatus,
    setUserOnCall,
    setUserStatus,
    userStatusFromProfile,
    userStatusTextWithinMaxLength,
} from "./userStatus";

describe("userStatus utils", () => {
    describe("userStatusFromProfile", () => {
        it("returns the user status if it is valid", () => {
            expect(userStatusFromProfile({ emoji: "🐳", text: "Feeling a little blue" }, undefined)).toEqual({
                emoji: "🐳",
                text: "Feeling a little blue",
            });
        });

        it("returns undefined if the user status is invalid and there is no call status", () => {
            expect(userStatusFromProfile({ text: "Feeling a little blue" }, undefined)).toBeUndefined();
        });

        it("returns the call status if the user status is invalid but the call status is valid", () => {
            expect(userStatusFromProfile({ text: "Feeling a little blue" }, { call_joined_ts: 12345 })).toEqual({
                emoji: "📞",
                text: "On a call",
            });
        });

        it("prefers the user status over the call status if both are valid", () => {
            expect(
                userStatusFromProfile({ emoji: "🐳", text: "Feeling a little blue" }, { call_joined_ts: 12345 }),
            ).toEqual({
                emoji: "🐳",
                text: "Feeling a little blue",
            });
        });

        it("returns undefined if the call status has a non-positive call_joined_ts", () => {
            expect(userStatusFromProfile(undefined, { call_joined_ts: 0 })).toBeUndefined();
        });

        it("returns undefined if neither status is valid", () => {
            expect(userStatusFromProfile(undefined, undefined)).toBeUndefined();
        });
    });

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

    describe("setUserOnCall", () => {
        let client: MatrixClient;

        beforeEach(() => {
            client = stubClient();
        });

        it("sets the call status with the current time if onCall is true", () => {
            vi.useFakeTimers().setSystemTime(12345);

            setUserOnCall(client, true);

            expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.call", {
                call_joined_ts: 12345,
            });

            vi.useRealTimers();
        });

        it("clears the call status if onCall is false", () => {
            setUserOnCall(client, false);

            expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.call", null);
        });
    });
});
