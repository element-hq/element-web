/*
Copyright 2023 Yorusaka Miyabi <shadowrz@disroot.org>

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

import SdkConfig from "matrix-react-sdk/src/SdkConfig";
import PlatformPeg from "matrix-react-sdk/src/PlatformPeg";
import fetchMock from "fetch-mock-jest";

import { loadApp } from "../../src/vector/app";
import WebPlatform from "../../src/vector/platform/WebPlatform";

fetchMock.config.overwriteRoutes = true;

describe("Loading server config", function () {
    beforeEach(async () => {
        SdkConfig.reset();
        PlatformPeg.set(new WebPlatform());
        fetchMock.get("https://matrix-client.matrix.org/_matrix/client/versions", {
            unstable_features: {},
            versions: [],
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
        await loadApp({});
        expect((SdkConfig.get("validated_server_config") || {}).hsUrl).toBe("https://matrix-client.matrix.org");
    });

    it("should use the default_server_name when resolveable", async function () {
        SdkConfig.put({
            default_server_name: "matrix.org",
        });
        await loadApp({});
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
            await loadApp({});
            expect((SdkConfig.get("validated_server_config") || {}).hsUrl).toBe("https://matrix-client.matrix.org");
        },
    );
});
