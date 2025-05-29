/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as fs from "node:fs";

import type { Page } from "@playwright/test";
import { test, expect } from "../../element-web-test";
import { type ElementAppPage } from "../../pages/ElementAppPage";
import { type Credentials } from "../../plugins/homeserver";
import type { UserWidget } from "../../../src/utils/WidgetUtils-types.ts";

const STICKER_PICKER_WIDGET_ID = "fake-sticker-picker";
const STICKER_PICKER_WIDGET_NAME = "Fake Stickers";
const STICKER_NAME = "Test Sticker";
const ROOM_NAME_1 = "Sticker Test";
const ROOM_NAME_2 = "Sticker Test Two";
const STICKER_IMAGE = fs.readFileSync("playwright/sample-files/riot.png");

function getStickerMessage(contentUri: string, mimetype: string): string {
    return JSON.stringify({
        action: "m.sticker",
        api: "fromWidget",
        data: {
            name: "teststicker",
            description: STICKER_NAME,
            file: "test.png",
            content: {
                body: STICKER_NAME,
                info: {
                    h: 480,
                    mimetype: mimetype,
                    size: 13818,
                    w: 480,
                },
                msgtype: "m.sticker",
                url: contentUri,
            },
        },
        requestId: "1",
        widgetId: STICKER_PICKER_WIDGET_ID,
    });
}

function getWidgetHtml(contentUri: string, mimetype: string) {
    const stickerMessage = getStickerMessage(contentUri, mimetype);
    return `
    <html lang="en">
        <head>
            <title>Fake Sticker Picker</title>
            <script>
                window.onmessage = ev => {
                    if (ev.data.action === 'capabilities') {
                        window.parent.postMessage(Object.assign({
                            response: {
                                capabilities: ["m.sticker"]
                            },
                        }, ev.data), '*');
                    }
                };
            </script>
        </head>
        <body>
            <button name="Send" id="sendsticker">Press for sticker</button>
            <script>
                document.getElementById('sendsticker').onclick = () => {
                    window.parent.postMessage(${stickerMessage}, '*')
                };
            </script>
        </body>
    </html>
`;
}
async function openStickerPicker(app: ElementAppPage) {
    const options = await app.openMessageComposerOptions();
    await options.getByRole("menuitem", { name: "Sticker" }).click();
}

async function sendStickerFromPicker(page: Page) {
    const iframe = page.frameLocator(`iframe[title="${STICKER_PICKER_WIDGET_NAME}"]`);
    await iframe.locator("#sendsticker").click();

    // Sticker picker should close itself after sending.
    await expect(page.locator(".mx_AppTileFullWidth#stickers")).not.toBeVisible();
}

async function expectTimelineSticker(page: Page, serverName: string, roomId: string, contentUri: string) {
    const contentId = contentUri.split("/").slice(-1)[0];
    // Make sure it's in the right room
    await expect(page.locator(".mx_EventTile_sticker > a")).toHaveAttribute("href", new RegExp(`/${roomId}/`));

    // Make sure the image points at the sticker image. We will briefly show it
    // using the thumbnail URL, but as soon as that fails, we will switch to the
    // download URL.
    await expect(page.locator(`img[alt="${STICKER_NAME}"]`)).toHaveAttribute(
        "src",
        new RegExp(`/${serverName}/${contentId}`),
    );
}

async function expectFileTile(page: Page, roomId: string, contentUri: string) {
    await expect(page.locator(".mx_MFileBody_info_filename")).toContainText(STICKER_NAME);
}

async function setWidgetAccountData(
    app: ElementAppPage,
    user: Credentials,
    stickerPickerUrl: string,
    provideCreatorUserId: boolean = true,
) {
    await app.client.setAccountData("m.widgets", {
        [STICKER_PICKER_WIDGET_ID]: {
            content: {
                type: "m.stickerpicker",
                name: STICKER_PICKER_WIDGET_NAME,
                url: stickerPickerUrl,
                creatorUserId: provideCreatorUserId ? user.userId : undefined,
            },
            sender: user.userId,
            state_key: STICKER_PICKER_WIDGET_ID,
            type: "m.widget",
            id: STICKER_PICKER_WIDGET_ID,
        } as unknown as UserWidget,
    });
}

test.describe("Stickers", { tag: ["@no-firefox", "@no-webkit"] }, () => {
    test.use({
        displayName: "Sally",
        room: async ({ app }, use) => {
            const roomId = await app.client.createRoom({ name: ROOM_NAME_1 });
            await use({ roomId });
        },
    });

    // We spin up a web server for the sticker picker so that we're not testing to see if
    // sysadmins can deploy sticker pickers on the same Element domain - we actually want
    // to make sure that cross-origin postMessage works properly. This makes it difficult
    // to write the test though, as we have to juggle iframe logistics.
    //
    // See sendStickerFromPicker() for more detail on iframe comms.
    let stickerPickerUrl: string;

    test("should send a sticker to multiple rooms", async ({ webserver, page, app, user, room }) => {
        const roomId2 = await app.client.createRoom({ name: ROOM_NAME_2 });
        const { content_uri: contentUri } = await app.client.uploadContent(STICKER_IMAGE, { type: "image/png" });
        const widgetHtml = getWidgetHtml(contentUri, "image/png");
        stickerPickerUrl = webserver.start(widgetHtml);
        await setWidgetAccountData(app, user, stickerPickerUrl);

        await app.viewRoomByName(ROOM_NAME_1);
        await expect(page).toHaveURL(`/#/room/${room.roomId}`);
        await openStickerPicker(app);
        await sendStickerFromPicker(page);
        await expectTimelineSticker(page, user.homeServer, room.roomId, contentUri);

        // Ensure that when we switch to a different room that the sticker
        // goes to the right place
        await app.viewRoomByName(ROOM_NAME_2);
        await expect(page).toHaveURL(`/#/room/${roomId2}`);
        await openStickerPicker(app);
        await sendStickerFromPicker(page);
        await expectTimelineSticker(page, user.homeServer, roomId2, contentUri);
    });

    test("should handle a sticker picker widget missing creatorUserId", async ({
        webserver,
        page,
        app,
        user,
        room,
    }) => {
        const { content_uri: contentUri } = await app.client.uploadContent(STICKER_IMAGE, { type: "image/png" });
        const widgetHtml = getWidgetHtml(contentUri, "image/png");
        stickerPickerUrl = webserver.start(widgetHtml);
        await setWidgetAccountData(app, user, stickerPickerUrl, false);

        await app.viewRoomByName(ROOM_NAME_1);
        await expect(page).toHaveURL(`/#/room/${room.roomId}`);
        await openStickerPicker(app);
        await sendStickerFromPicker(page);
        await expectTimelineSticker(page, user.homeServer, room.roomId, contentUri);
    });

    test("should render invalid mimetype as a file", async ({ webserver, page, app, user, room }) => {
        const { content_uri: contentUri } = await app.client.uploadContent(STICKER_IMAGE, {
            type: "application/octet-stream",
        });
        const widgetHtml = getWidgetHtml(contentUri, "application/octet-stream");
        stickerPickerUrl = webserver.start(widgetHtml);
        await setWidgetAccountData(app, user, stickerPickerUrl);

        await app.viewRoomByName(ROOM_NAME_1);
        await expect(page).toHaveURL(`/#/room/${room.roomId}`);
        await openStickerPicker(app);
        await sendStickerFromPicker(page);
        await expectFileTile(page, room.roomId, contentUri);
    });
});
