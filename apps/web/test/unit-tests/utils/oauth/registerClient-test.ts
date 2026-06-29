/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "@fetch-mock/jest";
import { OAuth2Error } from "matrix-js-sdk/src/matrix";

import { getOAuthClientId } from "../../../../src/utils/oauth/registerClient";
import { mockPlatformPeg } from "../../../test-utils";
import PlatformPeg from "../../../../src/PlatformPeg";
import { makeDelegatedAuthMetadata } from "../../../test-utils/auth";

describe("getOAuthClientId()", () => {
    const issuer = "https://auth.com/";
    const clientName = "Element";
    const baseUrl = "https://just.testing";
    const dynamicClientId = "xyz789";
    const staticOAuthClients = {
        [issuer]: {
            client_id: "abc123",
        },
    };
    const delegatedAuthConfig = makeDelegatedAuthMetadata(issuer);

    beforeEach(() => {
        fetchMock.removeRoutes();
        mockPlatformPeg();
        Object.defineProperty(PlatformPeg.get(), "baseUrl", {
            get(): string {
                return baseUrl;
            },
        });
        Object.defineProperty(PlatformPeg.get(), "defaultOAuthClientUri", {
            get(): string {
                return baseUrl;
            },
        });
        Object.defineProperty(PlatformPeg.get(), "getOAuthCallbackUrl", {
            value: () => ({
                href: baseUrl,
            }),
        });
    });

    it("should return static clientId when configured", async () => {
        expect(await getOAuthClientId(delegatedAuthConfig, staticOAuthClients)).toEqual("abc123");
        // didn't try to register
        expect(fetchMock).toHaveFetchedTimes(0);
    });

    it("should make correct request to register client", async () => {
        fetchMock.post(delegatedAuthConfig.registration_endpoint!, {
            status: 200,
            body: JSON.stringify({ client_id: dynamicClientId }),
        });
        expect(await getOAuthClientId(delegatedAuthConfig)).toEqual(dynamicClientId);
        // didn't try to register
        expect(fetchMock).toHaveFetched(delegatedAuthConfig.registration_endpoint!, {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            method: "POST",
            body: {
                client_name: clientName,
                client_uri: baseUrl,
                response_types: ["code"],
                grant_types: ["authorization_code", "refresh_token"],
                redirect_uris: [baseUrl],
                token_endpoint_auth_method: "none",
                application_type: "web",
                logo_uri: `${baseUrl}/vector-icons/1024.png`,
            },
        });
    });

    it("should throw when registration request fails", async () => {
        fetchMock.post(delegatedAuthConfig.registration_endpoint!, {
            status: 500,
        });
        await expect(getOAuthClientId(delegatedAuthConfig)).rejects.toThrow(OAuth2Error.DynamicRegistrationFailed);
    });

    it("should throw when registration response is invalid", async () => {
        fetchMock.post(delegatedAuthConfig.registration_endpoint!, {
            status: 200,
            // no clientId in response
            body: "{}",
        });
        await expect(getOAuthClientId(delegatedAuthConfig)).rejects.toThrow(OAuth2Error.DynamicRegistrationInvalid);
    });
});
