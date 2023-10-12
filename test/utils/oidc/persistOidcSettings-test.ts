/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { IdTokenClaims } from "oidc-client-ts";

import {
    getStoredOidcClientId,
    getStoredOidcIdTokenClaims,
    getStoredOidcTokenIssuer,
    persistOidcAuthenticatedSettings,
} from "../../../src/utils/oidc/persistOidcSettings";

describe("persist OIDC settings", () => {
    beforeEach(() => {
        jest.spyOn(sessionStorage.__proto__, "getItem").mockClear().mockReturnValue(null);

        jest.spyOn(sessionStorage.__proto__, "setItem").mockClear();
    });

    const clientId = "test-client-id";
    const issuer = "https://auth.org/";
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
        it("should set clientId and issuer in session storage", () => {
            persistOidcAuthenticatedSettings(clientId, issuer, idTokenClaims);
            expect(sessionStorage.setItem).toHaveBeenCalledWith("mx_oidc_client_id", clientId);
            expect(sessionStorage.setItem).toHaveBeenCalledWith("mx_oidc_token_issuer", issuer);
            expect(sessionStorage.setItem).toHaveBeenCalledWith(
                "mx_oidc_id_token_claims",
                JSON.stringify(idTokenClaims),
            );
        });
    });

    describe("getStoredOidcTokenIssuer()", () => {
        it("should return issuer from session storage", () => {
            jest.spyOn(sessionStorage.__proto__, "getItem").mockReturnValue(issuer);
            expect(getStoredOidcTokenIssuer()).toEqual(issuer);
            expect(sessionStorage.getItem).toHaveBeenCalledWith("mx_oidc_token_issuer");
        });

        it("should return undefined when no issuer in session storage", () => {
            expect(getStoredOidcTokenIssuer()).toBeUndefined();
        });
    });

    describe("getStoredOidcClientId()", () => {
        it("should return clientId from session storage", () => {
            jest.spyOn(sessionStorage.__proto__, "getItem").mockReturnValue(clientId);
            expect(getStoredOidcClientId()).toEqual(clientId);
            expect(sessionStorage.getItem).toHaveBeenCalledWith("mx_oidc_client_id");
        });
        it("should throw when no clientId in session storage", () => {
            expect(() => getStoredOidcClientId()).toThrow("Oidc client id not found in storage");
        });
    });

    describe("getStoredOidcIdTokenClaims()", () => {
        it("should return issuer from session storage", () => {
            jest.spyOn(sessionStorage.__proto__, "getItem").mockReturnValue(JSON.stringify(idTokenClaims));
            expect(getStoredOidcIdTokenClaims()).toEqual(idTokenClaims);
            expect(sessionStorage.getItem).toHaveBeenCalledWith("mx_oidc_id_token_claims");
        });

        it("should return undefined when no issuer in session storage", () => {
            expect(getStoredOidcIdTokenClaims()).toBeUndefined();
        });
    });
});
