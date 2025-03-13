/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Update", () => {
    const NEW_VERSION = "some-new-version";

    test.use({
        displayName: "Ursa",
    });

    test.beforeEach(async ({ context }) => {
        await context.route("/version*", async (route) => {
            await route.fulfill({
                body: NEW_VERSION,
                headers: {
                    "Content-Type": "test/plain",
                },
            });
        });
    });

    test("should navigate to ?updated=$VERSION if realises it is immediately out of date on load", async ({
        page,
        user,
    }) => {
        await expect(page).toHaveURL(/updated=/);
        expect(new URL(page.url()).searchParams.get("updated")).toEqual(NEW_VERSION);
    });
});
