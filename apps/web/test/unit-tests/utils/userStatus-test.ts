/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import {
    clearUserStatus,
    isUserOnCall,
    resolveUserStatus,
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

    describe("isUserOnCall", () => {
        it("returns true for an object value", () => {
            expect(isUserOnCall({})).toBe(true);
            expect(isUserOnCall({ call_joined_ts: 12345 })).toBe(true);
        });
        it("returns false for undefined", () => {
            expect(isUserOnCall(undefined)).toBe(false);
        });
        it("returns false for null", () => {
            expect(isUserOnCall(null)).toBe(false);
        });
        it("returns false for a non-object value", () => {
            expect(isUserOnCall("in a call")).toBe(false);
        });
    });

    describe("resolveUserStatus", () => {
        it("returns undefined when neither m.status nor m.call are set", () => {
            expect(resolveUserStatus(undefined, undefined)).toBeUndefined();
        });
        it("returns the m.status value when only m.status is set", () => {
            expect(resolveUserStatus({ emoji: "🐎", text: "on a horse" }, undefined)).toEqual({
                emoji: "🐎",
                text: "on a horse",
            });
        });
        it("returns the call status when only m.call is set", () => {
            expect(resolveUserStatus(undefined, {})).toEqual({ emoji: "🎧", text: "On a call" });
        });
        it("prefers m.status over m.call when both are set", () => {
            expect(resolveUserStatus({ emoji: "🐎", text: "on a horse" }, {})).toEqual({
                emoji: "🐎",
                text: "on a horse",
            });
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
