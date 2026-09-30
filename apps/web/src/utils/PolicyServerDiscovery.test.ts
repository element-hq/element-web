/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lookupPolicyServer, lookupSupportPage, normalisePolicyServerName } from "./PolicyServerDiscovery";

function mockResponse(status: number, body?: unknown): Partial<Response> {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => (body === undefined ? Promise.reject(new Error("no body")) : Promise.resolve(body)),
    };
}

describe("PolicyServerDiscovery", () => {
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        fetchMock.mockReset();
    });

    describe("normalisePolicyServerName", () => {
        it.each([
            ["policy.example.org", "policy.example.org"],
            ["  policy.example.org  ", "policy.example.org"],
            ["https://policy.example.org", "policy.example.org"],
            ["https://policy.example.org/", "policy.example.org"],
            ["http://localhost:8448/some/path?x=1", "localhost:8448"],
            ["", ""],
        ])("normalises %j to %j", (input, expected) => {
            expect(normalisePolicyServerName(input)).toBe(expected);
        });
    });

    describe("lookupPolicyServer", () => {
        it("fetches the stable well-known document over https and returns its public keys", async () => {
            fetchMock.mockResolvedValue(
                mockResponse(200, { public_keys: { ed25519: "abc", other: "def" } }) as Response,
            );

            await expect(lookupPolicyServer("policy.example.org")).resolves.toEqual({
                public_keys: { ed25519: "abc", other: "def" },
            });
            expect(fetchMock).toHaveBeenCalledWith(
                "https://policy.example.org/.well-known/matrix/policy_server",
                expect.objectContaining({ method: "GET", credentials: "omit" }),
            );
        });

        it("rejects when the server does not serve the document", async () => {
            fetchMock.mockResolvedValue(mockResponse(404) as Response);

            await expect(lookupPolicyServer("policy.example.org")).rejects.toThrow(/HTTP 404/);
        });

        it.each([
            ["an empty body", {}],
            ["a pre-stabilisation public_key string", { public_key: "abc" }],
            ["a missing ed25519 key", { public_keys: { rsa: "abc" } }],
            ["an empty ed25519 key", { public_keys: { ed25519: "" } }],
            ["a non-string key", { public_keys: { ed25519: "abc", other: 42 } }],
        ])("rejects %s", async (_name, body) => {
            fetchMock.mockResolvedValue(mockResponse(200, body) as Response);

            await expect(lookupPolicyServer("policy.example.org")).rejects.toThrow(/public_keys\.ed25519/);
        });

        it("rejects when the request fails", async () => {
            fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

            await expect(lookupPolicyServer("policy.example.org")).rejects.toThrow("Failed to fetch");
        });
    });

    describe("lookupSupportPage", () => {
        it("returns the advertised support page", async () => {
            fetchMock.mockResolvedValue(
                mockResponse(200, { support_page: "https://policy.example.org/support" }) as Response,
            );

            await expect(lookupSupportPage("policy.example.org")).resolves.toBe("https://policy.example.org/support");
            expect(fetchMock).toHaveBeenCalledWith(
                "https://policy.example.org/.well-known/matrix/support",
                expect.anything(),
            );
        });

        it.each([
            ["no support page", { contacts: [] }],
            ["a non-web URL", { support_page: "javascript:alert(1)" }],
            ["a relative URL", { support_page: "/support" }],
        ])("returns undefined for %s", async (_name, body) => {
            fetchMock.mockResolvedValue(mockResponse(200, body) as Response);

            await expect(lookupSupportPage("policy.example.org")).resolves.toBeUndefined();
        });

        it("returns undefined when the document cannot be fetched", async () => {
            fetchMock.mockResolvedValue(mockResponse(404) as Response);

            await expect(lookupSupportPage("policy.example.org")).resolves.toBeUndefined();
        });

        it("returns undefined when the request fails", async () => {
            fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

            await expect(lookupSupportPage("policy.example.org")).resolves.toBeUndefined();
        });
    });
});
