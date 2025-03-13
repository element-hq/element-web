/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Yorusaka Miyabi <shadowrz@disroot.org>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "fetch-mock-jest";

import SdkConfig from "../../src/SdkConfig";
import PlatformPeg from "../../src/PlatformPeg";
import { loadApp } from "../../src/vector/app";
import WebPlatform from "../../src/vector/platform/WebPlatform";

/** The matrix versions our mock server claims to support */
const SERVER_SUPPORTED_MATRIX_VERSIONS = ["v1.1", "v1.5", "v1.6", "v1.8", "v1.9"];

fetchMock.config.overwriteRoutes = true;

describe("Loading server config", function () {
    beforeEach(async () => {
        SdkConfig.reset();
        PlatformPeg.set(new WebPlatform());
        fetchMock.get("https://matrix-client.matrix.org/_matrix/client/versions", {
            unstable_features: {},
            versions: SERVER_SUPPORTED_MATRIX_VERSIONS,
        });
        fetchMock.get("https://matrix.org/.well-known/matrix/client", {
            "m.homeserver": {
                base_url: "https://matrix-client.matrix.org",
            },
        });
        fetchMock.get("/version", "1.10.13");
    });

    it("should use the default_server_config", async function () {
        SdkConfig.put({
            default_server_config: {
                "m.homeserver": {
                    base_url: "https://matrix-client.matrix.org",
                },
            },
        });
        await loadApp({}, null);
        expect((SdkConfig.get("validated_server_config") || {}).hsUrl).toBe("https://matrix-client.matrix.org");
    });

    it("should use the default_server_name when resolveable", async function () {
        SdkConfig.put({
            default_server_name: "matrix.org",
        });
        await loadApp({}, null);
        expect((SdkConfig.get("validated_server_config") || {}).hsUrl).toBe("https://matrix-client.matrix.org");
    });

    it(
        "should not throw when both default_server_name and default_server_config is specified " +
            "and default_server_name isn't resolvable",
        async function () {
            fetchMock.get("https://matrix.org/.well-known/matrix/client", 500);
            SdkConfig.put({
                default_server_name: "matrix.org",
                default_server_config: {
                    "m.homeserver": {
                        base_url: "https://matrix-client.matrix.org",
                    },
                },
            });
            await loadApp({}, null);
            expect((SdkConfig.get("validated_server_config") || {}).hsUrl).toBe("https://matrix-client.matrix.org");
        },
    );
});
