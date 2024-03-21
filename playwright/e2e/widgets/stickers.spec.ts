/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import type { Page } from "@playwright/test";
import { test, expect } from "../../element-web-test";
import { ElementAppPage } from "../../pages/ElementAppPage";

const STICKER_PICKER_WIDGET_ID = "fake-sticker-picker";
const STICKER_PICKER_WIDGET_NAME = "Fake Stickers";
const STICKER_NAME = "Test Sticker";
const ROOM_NAME_1 = "Sticker Test";
const ROOM_NAME_2 = "Sticker Test Two";
const STICKER_MESSAGE = JSON.stringify({
    action: "m.sticker",
    api: "fromWidget",
    data: {
        name: "teststicker",
        description: STICKER_NAME,
        file: "test.png",
        content: {
            body: STICKER_NAME,
            msgtype: "m.sticker",
            url: "mxc://localhost/somewhere",
        },
    },
    requestId: "1",
    widgetId: STICKER_PICKER_WIDGET_ID,
});
const WIDGET_HTML = `
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
                    window.parent.postMessage(${STICKER_MESSAGE}, '*')
                };
            </script>
        </body>
    </html>
`;

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

async function expectTimelineSticker(page: Page, roomId: string) {
    // Make sure it's in the right room
    await expect(page.locator(".mx_EventTile_sticker > a")).toHaveAttribute("href", new RegExp(`/${roomId}/`));

    // Make sure the image points at the sticker image. We will briefly show it
    // using the thumbnail URL, but as soon as that fails, we will switch to the
    // download URL.
    await expect(page.locator(`img[alt="${STICKER_NAME}"]`)).toHaveAttribute(
        "src",
        new RegExp("/download/localhost/somewhere"),
    );
}

test.describe("Stickers", () => {
    test.use({
        displayName: "Sally",
    });

    // We spin up a web server for the sticker picker so that we're not testing to see if
    // sysadmins can deploy sticker pickers on the same Element domain - we actually want
    // to make sure that cross-origin postMessage works properly. This makes it difficult
    // to write the test though, as we have to juggle iframe logistics.
    //
    // See sendStickerFromPicker() for more detail on iframe comms.
    let stickerPickerUrl: string;
    test.beforeEach(async ({ webserver }) => {
        stickerPickerUrl = webserver.start(WIDGET_HTML);
    });

    test("should send a sticker to multiple rooms", async ({ page, app, user }) => {
        const roomId1 = await app.client.createRoom({ name: ROOM_NAME_1 });
        const roomId2 = await app.client.createRoom({ name: ROOM_NAME_2 });

        await app.client.setAccountData("m.widgets", {
            [STICKER_PICKER_WIDGET_ID]: {
                content: {
                    type: "m.stickerpicker",
                    name: STICKER_PICKER_WIDGET_NAME,
                    url: stickerPickerUrl,
                    creatorUserId: user.userId,
                },
                sender: user.userId,
                state_key: STICKER_PICKER_WIDGET_ID,
                type: "m.widget",
                id: STICKER_PICKER_WIDGET_ID,
            },
        });

        await app.viewRoomByName(ROOM_NAME_1);
        await expect(page).toHaveURL(`/#/room/${roomId1}`);
        await openStickerPicker(app);
        await sendStickerFromPicker(page);
        await expectTimelineSticker(page, roomId1);

        // Ensure that when we switch to a different room that the sticker
        // goes to the right place
        await app.viewRoomByName(ROOM_NAME_2);
        await expect(page).toHaveURL(`/#/room/${roomId2}`);
        await openStickerPicker(app);
        await sendStickerFromPicker(page);
        await expectTimelineSticker(page, roomId2);
    });

    test("should handle a sticker picker widget missing creatorUserId", async ({ page, app, user }) => {
        const roomId1 = await app.client.createRoom({ name: ROOM_NAME_1 });

        await app.client.setAccountData("m.widgets", {
            [STICKER_PICKER_WIDGET_ID]: {
                content: {
                    type: "m.stickerpicker",
                    name: STICKER_PICKER_WIDGET_NAME,
                    url: stickerPickerUrl,
                    // No creatorUserId
                },
                sender: user.userId,
                state_key: STICKER_PICKER_WIDGET_ID,
                type: "m.widget",
                id: STICKER_PICKER_WIDGET_ID,
            },
        });

        await app.viewRoomByName(ROOM_NAME_1);
        await expect(page).toHaveURL(`/#/room/${roomId1}`);
        await openStickerPicker(app);
        await sendStickerFromPicker(page);
        await expectTimelineSticker(page, roomId1);
    });
});
