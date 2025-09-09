/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SettingLevel } from "../../../src/settings/SettingLevel";
import { test, expect } from "../../element-web-test";

test.describe("Room upgrade dialog", () => {
    test.use({
        displayName: "Alice",
    });

    test(
        "should render the room upgrade dialog",
        { tag: "@screenshot" },
        async ({ page, homeserver, user, app, axe }) => {
            // Enable developer mode
            await app.settings.setValue("developerMode", null, SettingLevel.ACCOUNT, true);

            await app.client.createRoom({ name: "Test Room" });
            await app.viewRoomByName("Test Room");

            const composer = app.getComposer().locator("[contenteditable]");
            // Pick a room version that is likely to be supported by all our target homeservers.
            await composer.fill("/upgraderoom 5");
            await composer.press("Enter");
            const dialog = page.locator(".mx_Dialog");
            await dialog.getByLabel("Automatically invite members from this room to the new one").check();

            axe.disableRules("color-contrast"); // XXX: Inheriting colour contrast issues from room view.
            await expect(axe).toHaveNoViolations();
            await expect(dialog).toMatchScreenshot("upgrade-room.png");
        },
    );
});
