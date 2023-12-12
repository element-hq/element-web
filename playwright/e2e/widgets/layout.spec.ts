/*
Copyright 2022 Oliver Sand
Copyright 2022 Nordeck IT + Consulting GmbH.
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { test, expect } from "../../element-web-test";

const ROOM_NAME = "Test Room";
const WIDGET_ID = "fake-widget";
const WIDGET_HTML = `
    <html lang="en">
        <head>
            <title>Fake Widget</title>
        </head>
        <body>
            Hello World
        </body>
    </html>
`;

test.describe("Widget Layout", () => {
    test.use({
        displayName: "Sally",
    });

    let roomId: string;
    let widgetUrl: string;
    test.beforeEach(async ({ webserver, app, user }) => {
        widgetUrl = webserver.start(WIDGET_HTML);

        roomId = await app.client.createRoom({ name: ROOM_NAME });

        // setup widget via state event
        await app.client.sendStateEvent(
            roomId,
            "im.vector.modular.widgets",
            {
                id: WIDGET_ID,
                creatorUserId: "somebody",
                type: "widget",
                name: "widget",
                url: widgetUrl,
            },
            WIDGET_ID,
        );

        // set initial layout
        await app.client.sendStateEvent(
            roomId,
            "io.element.widgets.layout",
            {
                widgets: {
                    [WIDGET_ID]: {
                        container: "top",
                        index: 1,
                        width: 100,
                        height: 0,
                    },
                },
            },
            "",
        );

        // open the room
        await app.viewRoomByName(ROOM_NAME);
    });

    test("should be set properly", async ({ page }) => {
        await expect(page.locator(".mx_AppsDrawer")).toMatchScreenshot("apps-drawer.png");
    });

    test("manually resize the height of the top container layout", async ({ page }) => {
        const iframe = page.locator('iframe[title="widget"]');
        expect((await iframe.boundingBox()).height).toBeLessThan(250);

        await page.locator(".mx_AppsDrawer_resizer_container_handle").hover();
        await page.mouse.down();
        await page.mouse.move(0, 550);
        await page.mouse.up();

        expect((await iframe.boundingBox()).height).toBeGreaterThan(400);
    });

    test("programmatically resize the height of the top container layout", async ({ page, app }) => {
        const iframe = page.locator('iframe[title="widget"]');
        expect((await iframe.boundingBox()).height).toBeLessThan(250);

        await app.client.sendStateEvent(
            roomId,
            "io.element.widgets.layout",
            {
                widgets: {
                    [WIDGET_ID]: {
                        container: "top",
                        index: 1,
                        width: 100,
                        height: 500,
                    },
                },
            },
            "",
        );

        await expect.poll(async () => (await iframe.boundingBox()).height).toBeGreaterThan(400);
    });
});
