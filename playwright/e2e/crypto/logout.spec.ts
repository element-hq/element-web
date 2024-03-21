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
import { createRoom, enableKeyBackup, logIntoElement, sendMessageInCurrentRoom } from "./utils";

test.describe("Logout tests", () => {
    test.beforeEach(async ({ page, homeserver, credentials }) => {
        await logIntoElement(page, homeserver, credentials);
    });

    test("Ask to set up recovery on logout if not setup", async ({ page, app }) => {
        await createRoom(page, "E2e room", true);

        // send a message (will be the first one so will create a new megolm session)
        await sendMessageInCurrentRoom(page, "Hello secret world");

        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "Sign out", exact: true }).click();

        const currentDialogLocator = page.locator(".mx_Dialog");

        await expect(
            currentDialogLocator.getByRole("heading", { name: "You'll lose access to your encrypted messages" }),
        ).toBeVisible();
    });

    test("If backup is set up show standard confirm", async ({ page, app }) => {
        await enableKeyBackup(app);

        await createRoom(page, "E2e room", true);

        // send a message (will be the first one so will create a new megolm session)
        await sendMessageInCurrentRoom(page, "Hello secret world");

        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "Sign out", exact: true }).click();

        const currentDialogLocator = page.locator(".mx_Dialog");

        await expect(currentDialogLocator.getByText("Are you sure you want to sign out?")).toBeVisible();
    });

    test("Logout directly if the user has no room keys", async ({ page, app }) => {
        await createRoom(page, "Clear room", false);

        await sendMessageInCurrentRoom(page, "Hello public world!");

        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "Sign out", exact: true }).click();

        // Should have logged out directly
        await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
});
