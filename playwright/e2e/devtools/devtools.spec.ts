/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Devtools", () => {
    test.use({
        displayName: "Alice",
    });

    test("should render the devtools", { tag: "@screenshot" }, async ({ page, homeserver, user, app, axe }) => {
        await app.client.createRoom({ name: "Test Room" });
        await app.viewRoomByName("Test Room");

        const composer = app.getComposer().locator("[contenteditable]");
        await composer.fill("/devtools");
        await composer.press("Enter");
        const dialog = page.locator(".mx_Dialog");
        await dialog.getByLabel("Developer mode").check();

        axe.disableRules("color-contrast"); // XXX: Inheriting colour contrast issues from room view.
        await expect(axe).toHaveNoViolations();
        await expect(dialog).toMatchScreenshot("devtools-dialog.png", {
            css: `.mx_CopyableText {
                display: none;
            }`,
        });
    });
});
