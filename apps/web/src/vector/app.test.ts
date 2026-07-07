/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom
// @vitest-environment-options {"url": "https://app.element.io/#/room/#room:server"}

import { vi, describe, it, expect, afterAll, beforeEach } from "vitest";
import fetchMock from "@fetch-mock/vitest";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { mockPlatformPeg, unmockPlatformPeg } from "test-utils";
import { makeDelegatedAuthConfig } from "test-utils/oidc";
import { type RefCallback } from "react";

import { loadApp } from "./app.tsx";
import SdkConfig from "../SdkConfig.ts";
import PlatformPeg from "../PlatformPeg.ts";
import type MatrixChat from "../components/structures/MatrixChat.tsx";

const defaultConfig = {
    default_hs_url: "https://synapse",
};
const issuer = "https://auth.org/";

describe("sso_redirect_options", () => {
    beforeEach(() => {
        // Stable stub
        vi.spyOn(window.crypto, "getRandomValues").mockImplementation((arr) => {
            for (let i = 0; i < (<Uint8Array>arr).length; i++) {
                (<Uint8Array>arr)[i] = i;
            }
            return arr;
        });
    });

    beforeEach(() => {
        SdkConfig.reset();
        mockPlatformPeg({ getDefaultDeviceDisplayName: vi.fn(), startSingleSignOn: vi.fn() });
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

            const startSingleSignOnSpy = vi.spyOn(PlatformPeg.get()!, "startSingleSignOn");

            await loadApp({}, vi.fn() as RefCallback<MatrixChat>);
            expect(startSingleSignOnSpy).toHaveBeenCalledWith(expect.any(MatrixClient), "sso", "/room/#room:server");
        });

        it("should redirect for native OIDC", async () => {
            const authConfig = { ...makeDelegatedAuthConfig(issuer), response_modes_supported: ["query", "fragment"] };
            fetchMock.get("https://synapse/_matrix/client/v1/auth_metadata", authConfig);
            fetchMock.get(`${authConfig.issuer}.well-known/openid-configuration`, authConfig);
            fetchMock.get(authConfig.jwks_uri!, { keys: [] });

            const startOidcLoginSpy = vi.spyOn(window.location, "href", "set");

            await loadApp({}, vi.fn() as RefCallback<MatrixChat>);
            expect(startOidcLoginSpy).toHaveBeenCalledWith(
                "https://auth.org/auth?client_id=12345&redirect_uri=https%3A%2F%2Fapp.element.io%2F%3Fno_universal_links%3Dtrue&response_type=code&scope=openid+urn%3Amatrix%3Aorg.matrix.msc2967.client%3Aapi%3A*+urn%3Amatrix%3Aorg.matrix.msc2967.client%3Adevice%3AABCDEFGHIJ&nonce=ABCDEFGHIJ&state=10000000100040008000100000000000&code_challenge=awE81eIsGff70JahvrTqWRbGKLI10ooyo_Xm1sxuZvU&code_challenge_method=S256&response_mode=fragment",
            );
        });
    });
});
