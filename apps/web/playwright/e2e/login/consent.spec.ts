/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { consentHomeserver } from "../../plugins/homeserver/synapse/consentHomeserver.ts";

test.use(consentHomeserver);
test.use({
    displayName: "Bob",
});

test.describe("Consent", () => {
    test("should prompt the user to consent to terms when server deems it necessary", async ({
        context,
        page,
        user,
        app,
    }) => {
        // Attempt to create a room using the js-sdk which should return an error with `M_CONSENT_NOT_GIVEN`
        await app.client.createRoom({}).catch(() => {});
        const newPagePromise = context.waitForEvent("page");

        const dialog = page.locator(".mx_QuestionDialog");
        // Accept terms & conditions
        await expect(dialog.getByRole("heading", { name: "Terms and Conditions" })).toBeVisible();
        await page.getByRole("button", { name: "Review terms and conditions" }).click();

        const newPage = await newPagePromise;
        await newPage.locator('[type="submit"]').click();
        await expect(newPage.getByText("Danke schoen")).toBeVisible();

        // go back to the app
        await page.goto("/");
        // wait for the app to re-load
        await expect(page.locator(".mx_MatrixChat")).toBeVisible();

        // attempt to perform the same action again and expect it to not fail
        await app.client.createRoom({ name: "Test Room" });
        await expect(page.getByText("Test Room")).toBeVisible();
    });
});
