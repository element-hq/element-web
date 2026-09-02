/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type EventType } from "matrix-js-sdk/src/matrix";

import { expect, test } from "../../element-web-test";
import { readSampleFileSync } from "../../sample-files";

const EMOTE_IMAGE = readSampleFileSync("riot.png", null);

test.describe("Custom emotes", () => {
    test.use({
        displayName: "Emote Tester",
        room: async ({ app, user: _user }, use) => {
            const roomId = await app.client.createRoom({ name: "Custom emotes" });
            await use({ roomId });
        },
    });

    test("sends and renders an emote from the room image pack", async ({ page, app, room }) => {
        const { content_uri: emoteUrl } = await app.client.uploadContent(EMOTE_IMAGE, { type: "image/png" });
        await app.client.sendStateEvent(
            room.roomId,
            "m.room.image_pack" as EventType,
            {
                pack: { display_name: "Room emotes", usage: ["emoticon"] },
                images: {
                    wave: {
                        url: emoteUrl,
                        body: "A friendly wave",
                        info: { mimetype: "image/png" },
                    },
                },
            },
            "room-emotes",
        );
        await expect
            .poll(() =>
                app.client.evaluate(
                    (client, roomId) =>
                        Boolean(
                            client.getRoom(roomId)?.currentState.getStateEvents("m.room.image_pack", "room-emotes"),
                        ),
                    room.roomId,
                ),
            )
            .toBe(true);

        await page.goto(`#/room/${room.roomId}`);
        const composer = page.getByRole("textbox", { name: "Send an unencrypted message…" });
        await composer.fill(":wav");
        await expect(page.locator("img.mx_Autocomplete_Completion_customEmote")).toBeVisible();
        await composer.fill(":wave:");

        const sendRequestPromise = page.waitForRequest(
            (request) => request.method() === "PUT" && request.url().includes("/send/m.room.message/"),
        );
        await page.getByRole("button", { name: "Send message" }).click();
        const request = await sendRequestPromise;

        expect(request.postDataJSON()).toMatchObject({
            msgtype: "m.text",
            body: ":wave:",
            format: "org.matrix.custom.html",
        });
        expect(request.postDataJSON().formatted_body).toContain(
            `<img data-mx-emoticon="" src="${emoteUrl}" alt="A friendly wave" title="wave" height="32">`,
        );
        await expect(page.locator('.mx_EventTile_last img[data-mx-emoticon][title="wave"]')).toBeVisible();
        await page.locator('img[data-mx-emoticon][title="wave"]').click();
        const popover = page.locator(".mx_CustomEmoteInfo");
        await expect(popover).toBeVisible();
        await expect(popover.getByText(":wave:", { exact: true })).toBeVisible();
    });
});
