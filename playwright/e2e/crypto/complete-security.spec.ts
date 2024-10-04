/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { logIntoElement } from "./utils";

test.describe("Complete security", () => {
    test.use({
        displayName: "Jeff",
    });

    test("should go straight to the welcome screen if we have no signed device", async ({
        page,
        homeserver,
        credentials,
    }) => {
        await logIntoElement(page, homeserver, credentials);
        await expect(page.getByText("Welcome Jeff", { exact: true })).toBeVisible();
    });

    // see also "Verify device during login with SAS" in `verifiction.spec.ts`.
});
