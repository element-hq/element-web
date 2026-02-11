/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Quick settings menu", () => {
    test("should be rendered properly", { tag: "@screenshot" }, async ({ app, page, user }) => {
        await page.getByRole("button", { name: "Quick settings" }).click();
        // Assert that the top heading is renderedc
        const settings = page.getByTestId("quick-settings-menu");
        await expect(settings).toBeVisible();
        await expect(settings).toMatchScreenshot("quick-settings.png");
    });
});
