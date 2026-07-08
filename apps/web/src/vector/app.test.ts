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
import { makeDelegatedAuthMetadata } from "test-utils/auth";
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
            // Signal we support v1.15 to use stable Native OAuth2 support
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

        it("should redirect for native OAuth2", async () => {
            const authConfig = {
                ...makeDelegatedAuthMetadata(issuer),
                response_modes_supported: ["query", "fragment"],
            };
            fetchMock.get("https://synapse/_matrix/client/v1/auth_metadata", authConfig);

            const startOAuthLoginSpy = vi.spyOn(window.location, "href", "set");

            await loadApp({}, vi.fn() as RefCallback<MatrixChat>);
            expect(startOAuthLoginSpy).toHaveBeenCalledWith(
                "https://auth.org/auth?response_type=code&response_mode=fragment&client_id=12345&redirect_uri=https%3A%2F%2Fapp.element.io%2F%3Fno_universal_links%3Dtrue&scope=urn%3Amatrix%3Aclient%3Aapi%3A*+urn%3Amatrix%3Aclient%3Adevice%3AABCDEFGHIJ&state=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef&code_challenge_method=S256&code_challenge=ymW9_yTzfYF1Km4N7W4OC6jQ7xoj91DUulQHWfmrROM",
            );
        });
    });
});
