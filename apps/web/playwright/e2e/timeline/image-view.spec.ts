/*
Copyright 2026 Viktor Shchelochkov

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { readSampleFileSync } from "../../sample-files";

const IMAGE_FILE = readSampleFileSync("riot.png", null);

test.describe("Image view", () => {
    test.use({
        displayName: "Alice",
    });

    test("keeps the top bar at its full height", async ({ page, app }) => {
        const roomId = await app.client.createRoom({ name: "Pictures" });
        const upload = await app.client.uploadContent(IMAGE_FILE, { name: "image.png", type: "image/png" });
        await app.client.sendEvent(roomId, null, "m.room.message", {
            msgtype: "m.image",
            body: "image.png",
            url: upload.content_uri,
        });
        await app.viewRoomById(roomId);

        await page.locator(".mx_ImageBody").getByRole("img", { name: "image.png" }).click();
        const imageView = page.getByLabel("Image view");
        await expect(imageView).toBeVisible();

        // The buttons sit in the middle of the 68px top bar (--image-view-panel-height),
        // which the image area below must not squeeze
        const view = (await imageView.boundingBox())!;
        const closeButton = (await imageView.getByRole("button", { name: "Close" }).boundingBox())!;
        expect(closeButton.y + closeButton.height / 2 - view.y).toBeCloseTo(34, 0);
    });
});
