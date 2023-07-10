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

import fetchMockJest from "fetch-mock-jest";
import * as randomStringUtils from "matrix-js-sdk/src/randomstring";

import { startOidcLogin } from "../../../src/utils/oidc/authorize";
import { makeDelegatedAuthConfig, mockOpenIdConfiguration } from "../../test-utils/oidc";

describe("startOidcLogin()", () => {
    const issuer = "https://auth.com/";
    const homeserver = "https://matrix.org";
    const clientId = "xyz789";
    const baseUrl = "https://test.com";

    const delegatedAuthConfig = makeDelegatedAuthConfig(issuer);

    const sessionStorageGetSpy = jest.spyOn(sessionStorage.__proto__, "setItem").mockReturnValue(undefined);

    // to restore later
    const realWindowLocation = window.location;

    beforeEach(() => {
        fetchMockJest.mockClear();
        fetchMockJest.resetBehavior();

        sessionStorageGetSpy.mockClear();

        // @ts-ignore allow delete of non-optional prop
        delete window.location;
        // @ts-ignore ugly mocking
        window.location = {
            href: baseUrl,
            origin: baseUrl,
        };

        fetchMockJest.get(
            delegatedAuthConfig.metadata.issuer + ".well-known/openid-configuration",
            mockOpenIdConfiguration(),
        );
        jest.spyOn(randomStringUtils, "randomString").mockRestore();
    });

    afterAll(() => {
        window.location = realWindowLocation;
    });

    it("navigates to authorization endpoint with correct parameters", async () => {
        await startOidcLogin(delegatedAuthConfig, clientId, homeserver);

        const expectedScopeWithoutDeviceId = `openid urn:matrix:org.matrix.msc2967.client:api:* urn:matrix:org.matrix.msc2967.client:device:`;

        const authUrl = new URL(window.location.href);

        expect(authUrl.searchParams.get("response_mode")).toEqual("query");
        expect(authUrl.searchParams.get("response_type")).toEqual("code");
        expect(authUrl.searchParams.get("client_id")).toEqual(clientId);
        expect(authUrl.searchParams.get("code_challenge_method")).toEqual("S256");

        // scope ends with a 10char randomstring deviceId
        const scope = authUrl.searchParams.get("scope")!;
        expect(scope.substring(0, scope.length - 10)).toEqual(expectedScopeWithoutDeviceId);
        expect(scope.substring(scope.length - 10)).toBeTruthy();

        // random string, just check they are set
        expect(authUrl.searchParams.has("state")).toBeTruthy();
        expect(authUrl.searchParams.has("nonce")).toBeTruthy();
        expect(authUrl.searchParams.has("code_challenge")).toBeTruthy();
    });
});
