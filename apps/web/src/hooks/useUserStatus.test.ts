/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "test-utils-rtl";
import { ClientEvent } from "matrix-js-sdk/src/matrix";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
    mockClientMethodsServer,
    withContexts,
} from "test-utils";

import { useUserStatus } from "./useUserStatus";
import SettingsStore from "../settings/SettingsStore";
import { userStatusTextWithinMaxLength } from "../utils/userStatus";

const userId = "@alice:example.com";

const client = getMockClientWithEventEmitter({
    ...mockClientMethodsUser(),
    ...mockClientMethodsServer(),
    getCrypto: vi.fn().mockReturnValue(null),
    doesServerSupportExtendedProfiles: vi.fn().mockResolvedValue(true),
    getExtendedProfileProperty: vi.fn().mockResolvedValue(undefined),
});

function render(uid: string | undefined = userId) {
    return renderHook(() => useUserStatus(uid), withContexts({ matrixClient: client }));
}

describe("userStatusTextWithinMaxLength", () => {
    it("returns true for short text", () => {
        expect(userStatusTextWithinMaxLength("on a horse")).toBe(true);
    });

    it("returns false for text exceeding 256 bytes", () => {
        expect(userStatusTextWithinMaxLength("a".repeat(257))).toBe(false);
    });

    it("returns true for text exactly 256 bytes", () => {
        expect(userStatusTextWithinMaxLength("a".repeat(256))).toBe(true);
    });
});

describe("useUserStatus", () => {
    beforeEach(() => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation((name): any => {
            if (name === "feature_user_status") return true;
        });
        client.doesServerSupportExtendedProfiles.mockResolvedValue(true);
        client.getExtendedProfileProperty.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns undefined when feature is disabled", async () => {
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        const { result } = render();
        expect(result.current).toBeUndefined();
    });

    it("returns undefined when userId is undefined", async () => {
        const { result } = render(undefined);
        expect(result.current).toBeUndefined();
    });

    it("returns undefined when server does not support extended profiles", async () => {
        client.doesServerSupportExtendedProfiles.mockResolvedValue(false);
        const { result } = render();
        expect(result.current).toBeUndefined();
    });

    it("returns undefined when status property is not set", async () => {
        client.getExtendedProfileProperty.mockResolvedValue(undefined);
        const { result } = render();
        await waitFor(() =>
            expect(client.getExtendedProfileProperty).toHaveBeenCalledWith(userId, "org.matrix.msc4426.status"),
        );
        expect(result.current).toBeUndefined();
    });

    it("returns undefined when status is not an object", async () => {
        client.getExtendedProfileProperty.mockResolvedValue("not an object");
        const { result } = render();
        await waitFor(() => expect(client.getExtendedProfileProperty).toHaveBeenCalled());
        expect(result.current).toBeUndefined();
    });

    it("returns undefined when emoji is missing", async () => {
        client.getExtendedProfileProperty.mockResolvedValue({ text: "on a horse" });
        const { result } = render();
        await waitFor(() => expect(client.getExtendedProfileProperty).toHaveBeenCalled());
        expect(result.current).toBeUndefined();
    });

    it("returns undefined when text is missing", async () => {
        client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🐎" });
        const { result } = render();
        await waitFor(() => expect(client.getExtendedProfileProperty).toHaveBeenCalled());
        expect(result.current).toBeUndefined();
    });

    it("returns the user status when valid", async () => {
        client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🐎", text: "on a horse" });
        const { result } = render();
        await waitFor(() => expect(result.current).toEqual({ emoji: "🐎", text: "on a horse" }));
    });

    it("truncates text that exceeds 256 bytes", async () => {
        const longText = "a".repeat(257);
        client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🐎", text: longText });
        const { result } = render();
        await waitFor(() => expect(result.current).toEqual({ emoji: "🐎", text: `${"a".repeat(256)}…` }));
    });

    it("returns undefined when M_NOT_FOUND error is thrown", async () => {
        const error = new Error();
        client.getExtendedProfileProperty.mockRejectedValue(error);
        const { result } = render();
        await waitFor(() => expect(client.getExtendedProfileProperty).toHaveBeenCalled());
        expect(result.current).toBeUndefined();
    });

    it("updates status when UserProfileUpdate event is emitted", async () => {
        client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🐎", text: "on a horse" });
        const { result } = render();
        await waitFor(() => expect(result.current).toEqual({ emoji: "🐎", text: "on a horse" }));

        // Simulate a profile update event
        client.emit(ClientEvent.UserProfileUpdate, userId, {
            "org.matrix.msc4426.status": { emoji: "😵", text: "off a horse" },
        });

        await waitFor(() => expect(result.current).toEqual({ emoji: "😵", text: "off a horse" }));
    });

    it("ignores UserProfileUpdate events for different users", async () => {
        client.getExtendedProfileProperty.mockResolvedValue({ emoji: "🐎", text: "on a horse" });
        const { result } = render();
        await waitFor(() => expect(result.current).toEqual({ emoji: "🐎", text: "on a horse" }));

        client.emit(ClientEvent.UserProfileUpdate, "@bob:example.com", {
            "org.matrix.msc4426.status": { emoji: "🤷", text: "unrelated status" },
        });

        // Should still have original status
        expect(result.current).toEqual({ emoji: "🐎", text: "on a horse" });
    });
});
