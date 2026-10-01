/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { logIntoElement } from "../crypto/utils";

test.describe("Overwrite login action", () => {
    // This seems terminally flakey: https://github.com/element-hq/element-web/issues/27363
    // I tried verious things to try & deflake it, to no avail: https://github.com/matrix-org/matrix-react-sdk/pull/12506
    test.skip("Try replace existing login with new one", async ({ page, app, credentials, homeserver }) => {
        await logIntoElement(page, credentials);

        const userMenu = await app.openUserMenu();
        await expect(userMenu.getByText(credentials.userId)).toBeVisible();

        const bobRegister = await homeserver.registerUser("BobOverwrite", "p@ssword1!", "BOB");

        // just assert that it's a different user
        expect(credentials.userId).not.toBe(bobRegister.userId);

        const clientCredentials /* IMatrixClientCreds */ = {
            homeserverUrl: homeserver.baseUrl,
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
        await expect(page.getByText("Welcome BOB")).toBeVisible();
    });
});
