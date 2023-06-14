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

import { M_AUTHENTICATION } from "../../../src";
import { logger } from "../../../src/logger";
import {
    OidcDiscoveryError,
    validateOIDCIssuerWellKnown,
    validateWellKnownAuthentication,
} from "../../../src/oidc/validate";

describe("validateWellKnownAuthentication()", () => {
    const baseWk = {
        "m.homeserver": {
            base_url: "https://hs.org",
        },
    };
    it("should throw not supported error when wellKnown has no m.authentication section", () => {
        expect(() => validateWellKnownAuthentication(baseWk)).toThrow(OidcDiscoveryError.NotSupported);
    });

    it("should throw misconfigured error when authentication issuer is not a string", () => {
        const wk = {
            ...baseWk,
            [M_AUTHENTICATION.stable!]: {
                issuer: { url: "test.com" },
            },
        };
        expect(() => validateWellKnownAuthentication(wk)).toThrow(OidcDiscoveryError.Misconfigured);
    });

    it("should throw misconfigured error when authentication account is not a string", () => {
        const wk = {
            ...baseWk,
            [M_AUTHENTICATION.stable!]: {
                issuer: "test.com",
                account: { url: "test" },
            },
        };
        expect(() => validateWellKnownAuthentication(wk)).toThrow(OidcDiscoveryError.Misconfigured);
    });

    it("should throw misconfigured error when authentication account is false", () => {
        const wk = {
            ...baseWk,
            [M_AUTHENTICATION.stable!]: {
                issuer: "test.com",
                account: false,
            },
        };
        expect(() => validateWellKnownAuthentication(wk)).toThrow(OidcDiscoveryError.Misconfigured);
    });

    it("should return valid config when wk uses stable m.authentication", () => {
        const wk = {
            ...baseWk,
            [M_AUTHENTICATION.stable!]: {
                issuer: "test.com",
                account: "account.com",
            },
        };
        expect(validateWellKnownAuthentication(wk)).toEqual({
            issuer: "test.com",
            account: "account.com",
        });
    });

    it("should return valid config when m.authentication account is missing", () => {
        const wk = {
            ...baseWk,
            [M_AUTHENTICATION.stable!]: {
                issuer: "test.com",
            },
        };
        expect(validateWellKnownAuthentication(wk)).toEqual({
            issuer: "test.com",
        });
    });

    it("should remove unexpected properties", () => {
        const wk = {
            ...baseWk,
            [M_AUTHENTICATION.stable!]: {
                issuer: "test.com",
                somethingElse: "test",
            },
        };
        expect(validateWellKnownAuthentication(wk)).toEqual({
            issuer: "test.com",
        });
    });

    it("should return valid config when wk uses unstable prefix for m.authentication", () => {
        const wk = {
            ...baseWk,
            [M_AUTHENTICATION.unstable!]: {
                issuer: "test.com",
                account: "account.com",
            },
        };
        expect(validateWellKnownAuthentication(wk)).toEqual({
            issuer: "test.com",
            account: "account.com",
        });
    });
});

describe("validateOIDCIssuerWellKnown", () => {
    const validWk: any = {
        authorization_endpoint: "https://test.org/authorize",
        token_endpoint: "https://authorize.org/token",
        registration_endpoint: "https://authorize.org/regsiter",
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
    };
    beforeEach(() => {
        // stub to avoid console litter
        jest.spyOn(logger, "error")
            .mockClear()
            .mockImplementation(() => {});
    });

    it("should throw OP support error when wellKnown is not an object", () => {
        expect(() => {
            validateOIDCIssuerWellKnown([]);
        }).toThrow(OidcDiscoveryError.OpSupport);
        expect(logger.error).toHaveBeenCalledWith("Issuer configuration not found or malformed");
    });

    it("should log all errors before throwing", () => {
        expect(() => {
            validateOIDCIssuerWellKnown({
                ...validWk,
                authorization_endpoint: undefined,
                response_types_supported: [],
            });
        }).toThrow(OidcDiscoveryError.OpSupport);
        expect(logger.error).toHaveBeenCalledWith("OIDC issuer configuration: authorization_endpoint is invalid");
        expect(logger.error).toHaveBeenCalledWith(
            "OIDC issuer configuration: response_types_supported is invalid. code is required.",
        );
    });

    it("should return validated issuer config", () => {
        expect(validateOIDCIssuerWellKnown(validWk)).toEqual({
            authorizationEndpoint: validWk.authorization_endpoint,
            tokenEndpoint: validWk.token_endpoint,
            registrationEndpoint: validWk.registration_endpoint,
        });
    });

    it("should return validated issuer config without registrationendpoint", () => {
        const wk = { ...validWk };
        delete wk.registration_endpoint;
        expect(validateOIDCIssuerWellKnown(wk)).toEqual({
            authorizationEndpoint: validWk.authorization_endpoint,
            tokenEndpoint: validWk.token_endpoint,
            registrationEndpoint: undefined,
        });
    });

    type TestCase = [string, any];
    it.each<TestCase>([
        ["authorization_endpoint", undefined],
        ["authorization_endpoint", { not: "a string" }],
        ["token_endpoint", undefined],
        ["token_endpoint", { not: "a string" }],
        ["registration_endpoint", { not: "a string" }],
        ["response_types_supported", undefined],
        ["response_types_supported", "not an array"],
        ["response_types_supported", ["doesnt include code"]],
        ["grant_types_supported", undefined],
        ["grant_types_supported", "not an array"],
        ["grant_types_supported", ["doesnt include authorization_code"]],
        ["code_challenge_methods_supported", undefined],
        ["code_challenge_methods_supported", "not an array"],
        ["code_challenge_methods_supported", ["doesnt include S256"]],
    ])("should throw OP support error when %s is %s", (key, value) => {
        const wk = {
            ...validWk,
            [key]: value,
        };
        expect(() => validateOIDCIssuerWellKnown(wk)).toThrow(OidcDiscoveryError.OpSupport);
    });
});
