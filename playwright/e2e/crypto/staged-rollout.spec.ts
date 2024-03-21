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
import { createRoom, enableKeyBackup, logIntoElement, logOutOfElement, sendMessageInCurrentRoom } from "./utils";
import { SettingLevel } from "../../../src/settings/SettingLevel";

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
        test.slow();

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
        test.slow();
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
        test.slow();

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

    test("Migrate using labflag should work", async ({ page, context, app, credentials, homeserver }, workerInfo) => {
        test.skip(
            workerInfo.project.name === "Rust Crypto",
            "No need to test this on Rust Crypto as we override the config manually",
        );
        test.slow();

        await page.goto("/#/login");

        // In the project.name = "Legacy crypto" it will be olm crypto
        await logIntoElement(page, homeserver, credentials);

        await app.settings.openUserSettings("Help & About");
        await expect(page.getByText("Crypto version: Olm")).toBeVisible();

        // We need to enable devtools for this test
        await app.settings.setValue("developerMode", null, SettingLevel.ACCOUNT, true);

        // Now simulate a refresh with `feature_rust_crypto` enabled but ensure no automatic migration
        await context.route(`http://localhost:8080/config.json*`, async (route) => {
            const json = {};
            json["features"] = {
                feature_rust_crypto: true,
            };
            json["setting_defaults"] = {
                "RustCrypto.staged_rollout_percent": 0,
            };
            await route.fulfill({ json });
        });

        await page.reload();

        // Go to the labs flag and enable the migration
        await app.settings.openUserSettings("Labs");
        await page.getByRole("switch", { name: "Rust cryptography implementation" }).click();

        // Fixes a bug where a missing session data was shown
        // https://github.com/element-hq/element-web/issues/26970

        await app.settings.openUserSettings("Help & About");
        await expect(page.getByText("Crypto version: Rust SDK")).toBeVisible();
    });

    test("Test migration of room shields", async ({ page, context, app, credentials, homeserver }, workerInfo) => {
        test.skip(
            workerInfo.project.name === "Rust Crypto",
            "No need to test this on Rust Crypto as we override the config manually",
        );
        test.slow();

        await page.goto("/#/login");

        // In the project.name = "Legacy crypto" it will be olm crypto
        await logIntoElement(page, homeserver, credentials);

        // create a room and send a message
        await createRoom(page, "Room1", true);
        await sendMessageInCurrentRoom(page, "Hello");

        // enable backup to save this room key
        const securityKey = await enableKeyBackup(app);

        // wait a bit for upload to complete, there is a random timout on key upload
        await page.waitForTimeout(6000);

        // logout
        await logOutOfElement(page);

        // We logout and log back in in order to get the historical key from backup and have a gray shield
        await page.reload();
        await page.goto("/#/login");
        // login again and verify
        await logIntoElement(page, homeserver, credentials, securityKey);

        await app.viewRoomByName("Room1");

        {
            const messageDiv = page.locator(".mx_EventTile_line").filter({ hasText: "Hello" });
            // there should be a shield
            await expect(messageDiv.locator(".mx_EventTile_e2eIcon")).toBeVisible();
        }

        // Now type a new  message
        await sendMessageInCurrentRoom(page, "World");

        // wait a bit for the message to be sent
        await expect(
            page
                .locator(".mx_EventTile_line")
                .filter({ hasText: "World" })
                .locator("..")
                .locator(".mx_EventTile_receiptSent"),
        ).toBeVisible();
        {
            const messageDiv = page.locator(".mx_EventTile_line").filter({ hasText: "World" });
            // there should not be a shield
            expect(await messageDiv.locator(".mx_EventTile_e2eIcon").count()).toEqual(0);
        }

        // trigger a migration
        await context.route(`http://localhost:8080/config.json*`, async (route) => {
            const json = {};
            json["features"] = {
                feature_rust_crypto: true,
            };
            json["setting_defaults"] = {
                "RustCrypto.staged_rollout_percent": 100,
            };
            await route.fulfill({ json });
        });

        await page.reload();

        await app.viewRoomByName("Room1");

        // The shields should be migrated properly
        {
            const messageDiv = page.locator(".mx_EventTile_line").filter({ hasText: "Hello" });
            await expect(messageDiv).toBeVisible();
            // there should be a shield
            await expect(messageDiv.locator(".mx_EventTile_e2eIcon")).toBeVisible();
        }
        {
            const messageDiv = page.locator(".mx_EventTile_line").filter({ hasText: "World" });
            await expect(messageDiv).toBeVisible();
            // there should not be a shield
            expect(await messageDiv.locator(".mx_EventTile_e2eIcon").count()).toEqual(0);
        }

        await app.settings.openUserSettings("Help & About");
        await expect(page.getByText("Crypto version: Rust SDK")).toBeVisible();
    });
});
