/**
 * @jest-environment jest-fixed-jsdom
 * @jest-environment-options {"url": "https://app.element.io/#/room/#room:server"}
 */

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "@fetch-mock/jest";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { Crypto } from "@peculiar/webcrypto";

import { loadApp } from "../../../src/vector/app.tsx";
import SdkConfig from "../../../src/SdkConfig.ts";
import PlatformPeg from "../../../src/PlatformPeg.ts";
import { mockPlatformPeg, unmockPlatformPeg } from "../../test-utils";
import { makeDelegatedAuthConfig } from "../../test-utils/oidc";

const defaultConfig = {
    default_hs_url: "https://synapse",
};
const issuer = "https://auth.org/";
const webCrypto = new Crypto();

describe("sso_redirect_options", () => {
    beforeAll(() => {
        Object.defineProperty(window, "crypto", {
            value: {
                // Stable stub
                getRandomValues: (arr: Uint8Array) => {
                    for (let i = 0; i < arr.length; i++) {
                        arr[i] = i;
                    }
                    return arr;
                },
                subtle: webCrypto.subtle,
            },
        });
    });

    beforeEach(() => {
        SdkConfig.reset();
        mockPlatformPeg({ getDefaultDeviceDisplayName: jest.fn(), startSingleSignOn: jest.fn() });
    });

    afterAll(() => {
        unmockPlatformPeg();
    });

    describe("immediate", () => {
        beforeEach(() => {
            SdkConfig.put({
                ...defaultConfig,
                sso_redirect_options: { immediate: true },
                // Avoid testing dynamic client registration
                oidc_static_clients: { [issuer]: { client_id: "12345" } },
            });
            // Signal we support v1.1 to pass the minimum js-sdk compatibility bar
            // Signal we support v1.15 to use stable Native OIDC support
            fetchMock.get("https://synapse/_matrix/client/versions", { versions: ["v1.1", "v1.15"] });
        });

        it("should redirect for legacy SSO", async () => {
            fetchMock.getOnce("https://synapse/_matrix/client/v3/login", {
                flows: [{ stages: ["m.login.sso"] }],
            });

            const startSingleSignOnSpy = jest.spyOn(PlatformPeg.get()!, "startSingleSignOn");

            await loadApp({}, jest.fn());
            expect(startSingleSignOnSpy).toHaveBeenCalledWith(expect.any(MatrixClient), "sso", "/room/#room:server");
        });

        it("should redirect for native OIDC", async () => {
            const authConfig = makeDelegatedAuthConfig(issuer);
            fetchMock.get("https://synapse/_matrix/client/v1/auth_metadata", authConfig);
            fetchMock.get(`${authConfig.issuer}.well-known/openid-configuration`, authConfig);
            fetchMock.get(authConfig.jwks_uri!, { keys: [] });

            const startOidcLoginSpy = jest.spyOn(window.location, "href", "set");

            await loadApp({}, jest.fn());
            expect(startOidcLoginSpy).toHaveBeenCalledWith(
                "https://auth.org/auth?client_id=12345&redirect_uri=https%3A%2F%2Fapp.element.io%2F%3Fno_universal_links%3Dtrue&response_type=code&scope=openid+urn%3Amatrix%3Aorg.matrix.msc2967.client%3Aapi%3A*+urn%3Amatrix%3Aorg.matrix.msc2967.client%3Adevice%3AwKpa6hpi3Y&nonce=38QgU2Pomx&state=10000000100040008000100000000000&code_challenge=awE81eIsGff70JahvrTqWRbGKLI10ooyo_Xm1sxuZvU&code_challenge_method=S256&response_mode=query",
            );
        });
    });
});
