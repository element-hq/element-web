/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { createBot, logIntoElement } from "./utils";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Complete security", () => {
    test.skip(isDendrite, "Dendrite lacks support for MSC3967 so requires additional auth here");
    test.use({
        displayName: "Jeff",
    });

    test(
        "Complete Security dialog appears correctly",
        { tag: "@screenshot" },
        async ({ page, credentials, homeserver }) => {
            await createBot(page, homeserver, credentials, true);
            await logIntoElement(page, credentials);
            await expect(page.getByRole("heading", { name: "Confirm your identity" })).toBeVisible();
            await expect(page.getByRole("main")).toMatchScreenshot("complete-security.png");
        },
    );

    test("should go straight to the welcome screen if we have no signed device", async ({
        page,
        homeserver,
        credentials,
    }) => {
        await logIntoElement(page, credentials);
        await expect(page.getByText("Welcome Jeff", { exact: true })).toBeVisible();
    });

    // see also "Verify device during login with SAS" in `verification.spec.ts`.
});
