/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Suguru Hirahara

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("LeftPanel", () => {
    test.use({
        displayName: "Hanako",
    });

    test("should render the Rooms list", async ({ page, app, user }) => {
        // create rooms and check room names are correct
        for (const name of ["Apple", "Pineapple", "Orange"]) {
            await app.client.createRoom({ name });
            await expect(page.getByRole("treeitem", { name })).toBeVisible();
        }
    });
});
