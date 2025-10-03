/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";
import { sample, uniqueId } from "lodash-es";

import { test as base } from "./services.js";
import { Credentials } from "../utils/api.js";

/** Adds an initScript to the given page which will populate localStorage appropriately so that Element will use the given credentials. */
export async function populateLocalStorageWithCredentials(page: Page, credentials: Credentials) {
    await page.addInitScript(
        ({ credentials }) => {
            window.localStorage.setItem("mx_hs_url", credentials.homeserverBaseUrl);
            window.localStorage.setItem("mx_user_id", credentials.userId);
            window.localStorage.setItem("mx_access_token", credentials.accessToken);
            window.localStorage.setItem("mx_device_id", credentials.deviceId);
            window.localStorage.setItem("mx_is_guest", "false");
            window.localStorage.setItem("mx_has_pickle_key", "false");
            window.localStorage.setItem("mx_has_access_token", "true");

            window.localStorage.setItem(
                "mx_local_settings",
                JSON.stringify({
                    // Retain any other settings which may have already been set
                    ...JSON.parse(window.localStorage.getItem("mx_local_settings") ?? "{}"),
                    // Ensure the language is set to a consistent value
                    language: "en",
                }),
            );
        },
        { credentials },
    );
}

export const test = base.extend<{
    /**
     * The displayname to use for the user registered in {@link #credentials}.
     *
     * To set it, call `test.use({ displayName: "myDisplayName" })` in the test file or `describe` block.
     * See {@link https://playwright.dev/docs/api/class-test#test-use}.
     */
    displayName?: string;

    /**
     * A test fixture which registers a test user on the {@link #homeserver} and supplies the details
     * of the registered user.
     */
    credentials: Credentials;

    /**
     * The same as {@link https://playwright.dev/docs/api/class-fixtures#fixtures-page|`page`},
     * but adds an initScript which will populate localStorage with the user's details from
     * {@link #credentials} and {@link #homeserver}.
     *
     * Similar to {@link #user}, but doesn't load the app.
     */
    pageWithCredentials: Page;

    /**
     * A (rather poorly-named) test fixture which registers a user per {@link #credentials}, stores
     * the credentials into localStorage per {@link #pageWithCredentials}, and then loads the front page of the
     * app.
     */
    user: Credentials;
}>({
    displayName: undefined,
    credentials: async ({ homeserver, displayName: testDisplayName }, use, testInfo) => {
        const names = ["Alice", "Bob", "Charlie", "Daniel", "Eve", "Frank", "Grace", "Hannah", "Isaac", "Judy"];
        const password = uniqueId("password_");
        const displayName = testDisplayName ?? sample(names)!;

        const credentials = await homeserver.registerUser(`user_${testInfo.testId}`, password, displayName);
        console.log(`Registered test user ${credentials.userId} with displayname ${displayName}`);

        await use({
            ...credentials,
            displayName,
        });
    },

    pageWithCredentials: async ({ page, credentials }, use) => {
        await populateLocalStorageWithCredentials(page, credentials);
        await use(page);
    },

    user: async ({ pageWithCredentials: page, credentials }, use) => {
        await page.goto("/");
        await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });
        await use(credentials);
    },
});
