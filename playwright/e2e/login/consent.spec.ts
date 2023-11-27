/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";

test.describe("Consent", () => {
    test.use({
        startHomeserverOpts: "consent",
        displayName: "Bob",
    });

    test("should prompt the user to consent to terms when server deems it necessary", async ({
        context,
        page,
        user,
        app,
    }) => {
        // Attempt to create a room using the js-sdk which should return an error with `M_CONSENT_NOT_GIVEN`
        await app.createRoom({}).catch(() => {});
        const newPagePromise = new Promise<Page>((resolve) => context.once("page", resolve));

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
        await app.createRoom({ name: "Test Room" });
        await expect(page.getByText("Test Room")).toBeVisible();
    });
});
