/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import os from "node:os";
import path from "node:path";
import * as fsp from "node:fs/promises";
import * as fs from "node:fs";
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js";

import { test, expect } from "../../element-web-test";

// Based on https://github.com/Stuk/jszip/issues/466#issuecomment-2097061912
async function extractZipFileToPath(file: string, outputPath: string): Promise<ZipReader<unknown>> {
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }

    const data = await fsp.readFile(file);
    const dataReader = new Uint8ArrayReader(new Uint8Array(data));
    const zip = new ZipReader(dataReader);
    const entries = await zip.getEntries();

    await new Promise<void>((resolve, reject) => {
        let entryCount = entries.length;
        let errorOut = false;

        entries.forEach((entry) => {
            if (errorOut) {
                return;
            }

            const outputEntryPath = path.join(outputPath, entry.filename);
            if (entry.directory) {
                if (!fs.existsSync(outputEntryPath)) {
                    fs.mkdirSync(outputEntryPath, { recursive: true });
                }

                entryCount--;

                if (entryCount === 0) {
                    resolve();
                }
            } else {
                const arrayWriter = new Uint8ArrayWriter();
                entry
                    .getData(arrayWriter)
                    .then(() => {
                        arrayWriter
                            .getData()
                            .then((buffer) => {
                                const stream = fs.createWriteStream(outputEntryPath);
                                stream.write(buffer, (error) => {
                                    if (error) {
                                        reject(error);
                                        errorOut = true;
                                    }
                                });
                                stream.on("finish", () => {
                                    entryCount--;

                                    if (entryCount === 0) {
                                        resolve();
                                    }
                                });
                                stream.end();
                            })
                            .catch((e) => {
                                errorOut = true;
                                reject(e);
                            });
                    })
                    .catch((e) => {
                        errorOut = true;
                        reject(e);
                    });
            }
        });
    });

    return zip;
}

test.describe("HTML Export", () => {
    test.use({
        displayName: "Alice",
        room: async ({ app, user }, use) => {
            const roomId = await app.client.createRoom({ name: "Important Room" });
            await app.viewRoomByName("Important Room");
            await use({ roomId });
        },
    });

    test(
        "should export html successfully and match screenshot",
        { tag: "@screenshot" },
        async ({ page, app, room }) => {
            // Set a fixed time rather than masking off the line with the time in it: we don't need to worry
            // about the width changing and we can actually test this line looks correct.
            await page.clock.setSystemTime(new Date("2024-01-01T00:00:00Z"));

            // Send a bunch of messages to populate the room
            for (let i = 1; i < 10; i++) {
                const response = await app.client.sendMessage(room.roomId, { body: `Testing ${i}`, msgtype: "m.text" });
                if (i == 1) {
                    await app.client.reactToMessage(room.roomId, null, response.event_id, "🙃");
                }
            }

            // Wait for all the messages to be displayed
            await expect(
                page.locator(".mx_EventTile_last .mx_MTextBody .mx_EventTile_body").getByText("Testing 9"),
            ).toBeVisible();

            await app.toggleRoomInfoPanel();
            await page.getByRole("menuitem", { name: "Export Chat" }).click();

            const downloadPromise = page.waitForEvent("download");
            await page.getByRole("button", { name: "Export", exact: true }).click();
            const download = await downloadPromise;

            const dirPath = path.join(os.tmpdir(), "html-export-test");
            const zipPath = `${dirPath}.zip`;
            await download.saveAs(zipPath);

            const zip = await extractZipFileToPath(zipPath, dirPath);
            const zipEntries = await zip.getEntries();
            const messagesHtmlPath = zipEntries.find((entry) => entry.filename.endsWith("/messages.html"))?.filename;
            expect(messagesHtmlPath).toBeDefined();
            await page.goto(`file://${dirPath}/${messagesHtmlPath}`);
            await expect(page).toMatchScreenshot("html-export.png", {
                mask: [
                    // We need to mask the whole thing because the width of the time part changes
                    page.locator(".mx_TimelineSeparator"),
                    page.locator(".mx_MessageTimestamp"),
                ],
            });
        },
    );
});
