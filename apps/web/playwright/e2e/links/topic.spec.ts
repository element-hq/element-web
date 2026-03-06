/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { test, expect } from "../../element-web-test";

test.describe("Topic links", () => {
    test.use({
        displayName: "Alice",
        room: async ({ user, app, bot }, use) => {
            const roomId = await app.client.createRoom({ name: "Test room" });
            await use({ roomId });
        },
    });
    for (const link of [
        "https://example.org",
        "example.org",
        "ftp://example.org",
        "#aroom:example.org",
        "@alice:example.org",
    ]) {
        // Playwright treats '@' as a tag, so replace it to be safe
        test(`should linkify plaintext '${link.replace("@", "_@")}'`, async ({ page, user, app, room }) => {
            await app.client.sendStateEvent(
                room.roomId,
                "m.room.topic",
                {
                    "m.topic": {
                        // Deliberately no HTML version.
                        "m.text": [
                            {
                                body: `An interesting room topic containing ${link}`,
                            },
                        ],
                    },
                    "topic": `An interesting room topic containing ${link}`,
                },
                "",
            );
            await page.goto(`#/room/${room.roomId}`);
            await expect(page.getByTestId("topic").getByRole("link", { name: link })).toBeVisible();
            const locator = await app.toggleRoomInfoPanel();
            await expect(locator.getByRole("link", { name: link })).toBeVisible();
        });
    }
});
