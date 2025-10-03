/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Browser } from "playwright-core";
import { Page } from "@playwright/test";

import { Credentials } from "./api.js";
import { Config } from "../index.js";
import { routeConfigJson } from "./config_json.js";
import { populateLocalStorageWithCredentials } from "../fixtures/user.js";

/** Create a new instance of the application, in a separate browser context, using the given credentials.
 *
 * @param browser - the browser to use
 * @param credentials - the credentials to use for the new instance
 * @param additionalConfig - additional config for the `config.json` for the new instance
 * @param labsFlags - additional labs flags for the `config.json` for the new instance
 * @param disablePresence - whether to disable presence for the new instance
 */
export async function createNewInstance(
    browser: Browser,
    credentials: Credentials,
    additionalConfig: Partial<Config> = {},
    labsFlags: string[] = [],
    disablePresence: boolean = false,
): Promise<Page> {
    const context = await browser.newContext();
    await routeConfigJson(context, credentials.homeserverBaseUrl, additionalConfig, labsFlags, disablePresence);
    const page = await context.newPage();
    await populateLocalStorageWithCredentials(page, credentials);
    await page.goto("/");
    await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });
    return page;
}
