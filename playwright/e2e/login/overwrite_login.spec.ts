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
import { logIntoElement } from "../crypto/utils";

test.describe("Overwrite login action", () => {
    test("Try replace existing login with new one", async ({ page, app, credentials, homeserver }) => {
        await logIntoElement(page, homeserver, credentials);

        const userMenu = await app.openUserMenu();
        await expect(userMenu.getByText(credentials.userId)).toBeVisible();

        const bobRegister = await homeserver.registerUser("BobOverwrite", "p@ssword1!", "BOB");

        // just assert that it's a different user
        expect(credentials.userId).not.toBe(bobRegister.userId);

        const clientCredentials /* IMatrixClientCreds */ = {
            homeserverUrl: homeserver.config.baseUrl,
            ...bobRegister,
        };

        // Trigger the overwrite login action
        await app.client.evaluate(async (cli, clientCredentials) => {
            // @ts-ignore - raw access to the dispatcher to simulate the action
            window.mxDispatcher.dispatch(
                {
                    action: "overwrite_login",
                    credentials: clientCredentials,
                },
                true,
            );
        }, clientCredentials);

        // It should be now another user!!
        const newUserMenu = await app.openUserMenu();
        await expect(newUserMenu.getByText(bobRegister.userId)).toBeVisible();
    });
});
