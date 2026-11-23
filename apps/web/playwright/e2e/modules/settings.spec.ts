/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { getSampleFilePath } from "../../sample-files";
import { SettingLevel } from "../../../src/settings/SettingLevel";

test.describe("Settings API", () => {
    test.use({
        displayName: "Manny",
        config: {
            modules: ["/modules/settings-module.js"],
            setting_defaults: {
                language: "de",
            },
        },
        page: async ({ page }, use) => {
            await page.route("/modules/settings-module.js", async (route) => {
                await route.fulfill({ path: getSampleFilePath("settings-module.js") });
            });
            await use(page);
        },
    });

    test("should read a config-resolved setting value via api.settings.getValue", async ({ page }) => {
        const dialogPromise = page.waitForEvent("dialog");
        await page.goto("/");
        const dialog = await dialogPromise;
        expect(dialog.message()).toBe("de");
    });

    test.describe("should support module settings", () => {
        test("should update the watchable when the setting changes", async ({ page, app }) => {
            const languageDialogPromise = page.waitForEvent("dialog");
            await page.goto("/");
            const languageDialog = await languageDialogPromise;

            // Accepting each alert lets the module's load() carry on; the last alert it shows is for the written setting.
            const writtenDialogPromise = page.waitForEvent("dialog");
            await languageDialog.accept();
            const writtenDialog = await writtenDialogPromise;
            await writtenDialog.accept();

            // The alert blocks the page, so wait for it before waiting for setValue to finish.
            const watchedDialogPromise = page.waitForEvent("dialog");
            const setValuePromise = app.settings.setValue(
                "module.settingsModule.watched",
                null,
                SettingLevel.DEVICE,
                true,
            );
            const watchedDialog = await watchedDialogPromise;
            expect(watchedDialog.message()).toBe("module.settingsModule.watched changed to true");
            await watchedDialog.accept();
            await setValuePromise;
        });

        test("should change a setting via api.settings.setValue", async ({ page }) => {
            const languageDialogPromise = page.waitForEvent("dialog");
            await page.goto("/");
            const languageDialog = await languageDialogPromise;

            // The module writes this setting after the language alert is accepted.
            const writtenDialogPromise = page.waitForEvent("dialog");
            await languageDialog.accept();
            const writtenDialog = await writtenDialogPromise;
            expect(writtenDialog.message()).toBe("module.settingsModule.written changed to foo");
            await writtenDialog.accept();
        });
    });
});
