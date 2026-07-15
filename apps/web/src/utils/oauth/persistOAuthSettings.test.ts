/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";

import { getStoredOAuthClientId, persistOAuthClientId } from "./persistOAuthSettings";

describe("persist OAuth2 settings", () => {
    vi.spyOn(localStorage, "getItem");
    vi.spyOn(localStorage, "setItem");

    beforeEach(() => {
        localStorage.clear();
    });

    const clientId = "test-client-id";

    describe("persistOAuthClientId", () => {
        it("should set clientId in localStorage", () => {
            persistOAuthClientId(clientId);
            expect(localStorage.setItem).toHaveBeenCalledWith("mx_oidc_client_id", clientId);
        });
    });

    describe("getStoredOAuthClientId()", () => {
        it("should return clientId from localStorage", () => {
            localStorage.setItem("mx_oidc_client_id", clientId);
            expect(getStoredOAuthClientId()).toEqual(clientId);
            expect(localStorage.getItem).toHaveBeenCalledWith("mx_oidc_client_id");
        });
        it("should throw when no clientId in localStorage", () => {
            expect(() => getStoredOAuthClientId()).toThrow("OAuth client ID not found in storage");
        });
    });
});
