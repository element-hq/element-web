/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

function formDataParser(data: string, contentType: string|null): Record<string, string> {
    const [_, boundary] = contentType?.split(';').map(v => v.trim()).find(v => v.startsWith('boundary='))?.split('=') ?? [];
    if (!boundary) {
        throw Error('No boundary found in form data request');
    }
    const dataMap: Record<string, string> = {};
    for (const dataPart of data.split(boundary).map(p => p.trim())) {
        const lines = dataPart.split('\r\n');
        const fieldName = lines[0].match(/name="([^"]+)"/)?.[1];
        if (!fieldName) {
            continue;
        }
        const data = lines.slice(1,-1).join('\n').trim();
        dataMap[fieldName] = data;
    }
    return dataMap;
}

test.describe("Rageshakes", () => {
    test.describe("visible when enabled", () => {
        test.use({
            config: {
                // Enable this just so the options show up.
                bug_report_endpoint_url: "https://example.org/bug-report-place"
            }
        });
        test("should be able to open bug report dialog via slash command", async ({ page, app, user }) => {
            await app.client.createRoom({ name: "Test room" });
            await app.viewRoomByName("Test room");
            const composer = app.getComposer().locator("[contenteditable]");
            await composer.fill("/rageshake");
            await composer.press("Enter");
            expect(page.getByRole("dialog", {name: "Submit debug logs"})).toBeVisible();
        });

        test("should be able to open bug report dialog via feedback dialog", async ({ page, app, user }) => {
            (await app.openUserMenu()).getByRole("menuitem", { name: "Feedback"}).click();
            const feedbackDialog = page.getByRole("dialog", {name: "Feedback"});
            await feedbackDialog.getByRole("button", { name: "debug logs"}).click();
            expect(page.getByRole("dialog", {name: "Submit debug logs"})).toBeVisible();
        });
        test("should be able to open bug report dialog via Settings", async ({ page, app, user }) => {
            const settings = await app.settings.openUserSettings("Help & About")
            await settings.getByRole("button", { name: "Submit debug logs"}).click();
            // Playwright can't see the dialog when both the settings and bug report dialogs are open, so key off heading.
            expect(page.getByRole("heading", {name: "Submit debug logs"})).toBeVisible();
        });
    });

    test.describe("hidden when disabled", () => {
        test("should NOT be able to open bug report dialog via slash command", async ({ page, app, user }) => {
            await app.client.createRoom({ name: "Test room" });
            await app.viewRoomByName("Test room");
            const composer = app.getComposer().locator("[contenteditable]");
            await composer.fill("/rageshake");
            await composer.press("Enter");
            expect(page.getByRole("dialog", {name: "Unknown command"})).toBeVisible();
        });

        test("should NOT be able to open bug report dialog via feedback dialog", async ({ page, app, user }) => {
            const menu = await app.openUserMenu()
            await expect(menu.getByRole("menuitem", { name: "Feedback"})).not.toBeVisible();
        });
        test("should NOT be able to open bug report dialog via Settings", async ({ page, app, user }) => {
            const settings = await app.settings.openUserSettings("Help & About")
            await expect(settings.getByRole("menuitem", { name: "Submit debug logs"})).not.toBeVisible();
        });
    });

    test.describe("via bug report endpoint", () => {
        test.use({
            config: {
                bug_report_endpoint_url: "http://example.org/bug-report-server"
            }
        });

        test("should be able to rageshake to a URL", { tag: "@screenshot" }, async ({ page, app, user }) => {
            await page.route("http://example.org/bug-report-server", async (route, request) => {
                if (request.method() !== 'POST') {
                    throw Error('Expected POST');
                }
                const fields = formDataParser(request.postData(), await request.headerValue('Content-Type'));
                expect(fields.text).toEqual('These are some notes\n\nIssue: https://github.com/element-hq/element-web/12345');
                expect(fields.app).toEqual('element-web');
                expect(fields.user_id).toEqual(user.userId);
                expect(fields.device_id).toEqual(user.deviceId);
                // We don't check the logs contents, but we'd like for there to be a log.
                expect(fields['compressed-log']).toBeDefined();
                return route.fulfill({ json: {}, status: 200 });
            });

            await app.client.createRoom({ name: "Test room" });
            await app.viewRoomByName("Test room");
            const composer = app.getComposer().locator("[contenteditable]");
            await composer.fill("/rageshake");
            await composer.press("Enter");
            const dialog = page.getByRole("dialog", {name: "Submit debug logs"});
            await dialog.getByRole("textbox", { name: "GitHub issue"}).fill("https://github.com/element-hq/element-web/12345");
            await dialog.getByRole("textbox", { name: "Notes"}).fill("These are some notes");
            await expect(dialog).toMatchScreenshot("rageshake_via_url.png");
            await dialog.getByRole("button", { name: "Send logs"}).click();
            await expect(page.getByRole("dialog", {name: "Logs sent"})).toBeVisible();
        });

    })
    test.describe("via local download", () => {
        test.use({
            config: {
                bug_report_endpoint_url: "local"
            }
        });

        test("should be able to rageshake to local download", { tag: "@screenshot" }, async ({ page, app, user }) => {
            await app.client.createRoom({ name: "Test room" });
            await app.viewRoomByName("Test room");
            const composer = app.getComposer().locator("[contenteditable]");
            await composer.fill("/rageshake");
            await composer.press("Enter");
            const dialog = page.getByRole("dialog", {name: "Submit debug logs"});
            await expect(dialog).toMatchScreenshot("rageshake_locally.png");
            const downloadPromise = page.waitForEvent("download");
            await dialog.getByRole("button", { name: "Download logs"}).click();
            const download = await downloadPromise;
            await download.cancel();
        });
    })
});
