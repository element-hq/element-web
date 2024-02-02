/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { test, expect } from "../../element-web-test";
import { logIntoElement } from "./utils";

test.describe("Adoption of rust stack", () => {
    test("Test migration of existing logins when rollout is 100%", async ({
        page,
        context,
        app,
        credentials,
        homeserver,
    }, workerInfo) => {
        test.skip(
            workerInfo.project.name === "Rust Crypto",
            "No need to test this on Rust Crypto as we override the config manually",
        );
        await page.goto("/#/login");

        let featureRustCrypto = false;
        let stagedRolloutPercent = 0;

        await context.route(`http://localhost:8080/config.json*`, async (route) => {
            const json = {
                default_server_config: {
                    "m.homeserver": {
                        base_url: "https://server.invalid",
                    },
                },
            };
            json["features"] = {
                feature_rust_crypto: featureRustCrypto,
            };
            json["setting_defaults"] = {
                "language": "en-GB",
                "RustCrypto.staged_rollout_percent": stagedRolloutPercent,
            };
            await route.fulfill({ json });
        });

        // reload to ensure we read the config
        await page.reload();

        await logIntoElement(page, homeserver, credentials);

        await app.settings.openUserSettings("Help & About");
        await expect(page.getByText("Crypto version: Olm")).toBeVisible();

        featureRustCrypto = true;

        await page.reload();

        await app.settings.openUserSettings("Help & About");
        await expect(page.getByText("Crypto version: Olm")).toBeVisible();

        stagedRolloutPercent = 100;

        await page.reload();

        await app.settings.openUserSettings("Help & About");
        await expect(page.getByText("Crypto version: Rust SDK")).toBeVisible();
    });

    test("Test new logins by default on rust stack", async ({
        page,
        context,
        app,
        credentials,
        homeserver,
    }, workerInfo) => {
        test.skip(
            workerInfo.project.name === "Rust Crypto",
            "No need to test this on Rust Crypto as we override the config manually",
        );
        await page.goto("/#/login");

        await context.route(`http://localhost:8080/config.json*`, async (route) => {
            const json = {
                default_server_config: {
                    "m.homeserver": {
                        base_url: "https://server.invalid",
                    },
                },
            };
            // we only want to test the default
            json["features"] = {};
            json["setting_defaults"] = {
                language: "en-GB",
            };
            await route.fulfill({ json });
        });

        // reload to get the new config
        await page.reload();
        await logIntoElement(page, homeserver, credentials);

        await app.settings.openUserSettings("Help & About");
        await expect(page.getByText("Crypto version: Rust SDK")).toBeVisible();
    });

    test("Test default is to not rollout existing logins", async ({
        page,
        context,
        app,
        credentials,
        homeserver,
    }, workerInfo) => {
        test.skip(
            workerInfo.project.name === "Rust Crypto",
            "No need to test this on Rust Crypto as we override the config manually",
        );

        await page.goto("/#/login");

        // In the project.name = "Legacy crypto" it will be olm crypto
        await logIntoElement(page, homeserver, credentials);

        await app.settings.openUserSettings("Help & About");
        await expect(page.getByText("Crypto version: Olm")).toBeVisible();

        // Now simulate a refresh with `feature_rust_crypto` enabled but ensure we use the default rollout
        await context.route(`http://localhost:8080/config.json*`, async (route) => {
            const json = {};
            json["features"] = {
                feature_rust_crypto: true,
            };
            json["setting_defaults"] = {
                // We want to test the default so we don't set this
                // "RustCrypto.staged_rollout_percent": 0,
            };
            await route.fulfill({ json });
        });

        await page.reload();

        await app.settings.openUserSettings("Help & About");
        await expect(page.getByText("Crypto version: Olm")).toBeVisible();
    });
});
