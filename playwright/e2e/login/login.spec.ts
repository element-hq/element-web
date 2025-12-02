/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test } from "../../element-web-test";
import { logIntoElement } from "../crypto/utils.ts";

test.describe(`With force_verification: true`, () => {
    test.use({
        config: {
            force_verification: true,
        },
    });

    test("Can reload after login", async ({ page, credentials }) => {
        // The page should reload fine when going to the base client URL
        // Regression test for https://github.com/element-hq/element-web/issues/31203
        await logIntoElement(page, credentials);

        // We should auto-upload the E2EE keys, and show a welcome page
        await expect(page.getByRole("heading", { name: `Welcome ${credentials.displayName}` })).toBeVisible();

        await page.goto("/");

        await expect(page.getByRole("heading", { name: `Welcome ${credentials.displayName}` })).toBeVisible();
    });
});
