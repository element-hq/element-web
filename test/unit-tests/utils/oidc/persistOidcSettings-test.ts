/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IdTokenClaims } from "oidc-client-ts";
import { decodeIdToken } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import {
    getStoredOidcClientId,
    getStoredOidcIdToken,
    getStoredOidcIdTokenClaims,
    getStoredOidcTokenIssuer,
    persistOidcAuthenticatedSettings,
} from "../../../../src/utils/oidc/persistOidcSettings";

jest.mock("matrix-js-sdk/src/matrix");

describe("persist OIDC settings", () => {
    jest.spyOn(Storage.prototype, "getItem");
    jest.spyOn(Storage.prototype, "setItem");

    beforeEach(() => {
        localStorage.clear();
    });

    const clientId = "test-client-id";
    const issuer = "https://auth.org/";
    const idToken = "test-id-token";
    const idTokenClaims: IdTokenClaims = {
        // audience is this client
        aud: "123",
        // issuer matches
        iss: issuer,
        sub: "123",
        exp: 123,
        iat: 456,
    };

    describe("persistOidcAuthenticatedSettings", () => {
        it("should set clientId and issuer in localStorage", () => {
            persistOidcAuthenticatedSettings(clientId, issuer, idToken);
            expect(localStorage.setItem).toHaveBeenCalledWith("mx_oidc_client_id", clientId);
            expect(localStorage.setItem).toHaveBeenCalledWith("mx_oidc_token_issuer", issuer);
            expect(localStorage.setItem).toHaveBeenCalledWith("mx_oidc_id_token", idToken);
        });
    });

    describe("getStoredOidcTokenIssuer()", () => {
        it("should return issuer from localStorage", () => {
            localStorage.setItem("mx_oidc_token_issuer", issuer);
            expect(getStoredOidcTokenIssuer()).toEqual(issuer);
            expect(localStorage.getItem).toHaveBeenCalledWith("mx_oidc_token_issuer");
        });

        it("should return undefined when no issuer in localStorage", () => {
            expect(getStoredOidcTokenIssuer()).toBeUndefined();
        });
    });

    describe("getStoredOidcClientId()", () => {
        it("should return clientId from localStorage", () => {
            localStorage.setItem("mx_oidc_client_id", clientId);
            expect(getStoredOidcClientId()).toEqual(clientId);
            expect(localStorage.getItem).toHaveBeenCalledWith("mx_oidc_client_id");
        });
        it("should throw when no clientId in localStorage", () => {
            expect(() => getStoredOidcClientId()).toThrow("Oidc client id not found in storage");
        });
    });

    describe("getStoredOidcIdToken()", () => {
        it("should return token from localStorage", () => {
            localStorage.setItem("mx_oidc_id_token", idToken);
            expect(getStoredOidcIdToken()).toEqual(idToken);
            expect(localStorage.getItem).toHaveBeenCalledWith("mx_oidc_id_token");
        });

        it("should return undefined when no token in localStorage", () => {
            expect(getStoredOidcIdToken()).toBeUndefined();
        });
    });

    describe("getStoredOidcIdTokenClaims()", () => {
        it("should return claims from localStorage", () => {
            localStorage.setItem("mx_oidc_id_token_claims", JSON.stringify(idTokenClaims));
            expect(getStoredOidcIdTokenClaims()).toEqual(idTokenClaims);
            expect(localStorage.getItem).toHaveBeenCalledWith("mx_oidc_id_token_claims");
        });

        it("should return claims extracted from id_token in localStorage", () => {
            localStorage.setItem("mx_oidc_id_token", idToken);
            mocked(decodeIdToken).mockReturnValue(idTokenClaims);
            expect(getStoredOidcIdTokenClaims()).toEqual(idTokenClaims);
            expect(decodeIdToken).toHaveBeenCalledWith(idToken);
            expect(localStorage.getItem).toHaveBeenCalledWith("mx_oidc_id_token_claims");
        });

        it("should return undefined when no claims in localStorage", () => {
            expect(getStoredOidcIdTokenClaims()).toBeUndefined();
        });
    });
});
