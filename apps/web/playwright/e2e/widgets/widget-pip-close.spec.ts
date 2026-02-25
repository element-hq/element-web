/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2022 Mikhail Aheichyk
Copyright 2022 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { IWidget } from "matrix-widget-api/src/interfaces/IWidget";
import type { MatrixEvent, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { test, expect } from "../../element-web-test";
import { type Client } from "../../pages/client";

const DEMO_WIDGET_ID = "demo-widget-id";
const DEMO_WIDGET_NAME = "Demo Widget";
const DEMO_WIDGET_TYPE = "demo";
const ROOM_NAME = "Demo";

const DEMO_WIDGET_HTML = `
    <html lang="en">
        <head>
            <title>Demo Widget</title>
            <script>
                window.onmessage = ev => {
                    if (ev.data.action === 'capabilities') {
                        window.parent.postMessage(Object.assign({
                            response: {
                                capabilities: []
                            },
                        }, ev.data), '*');
                    }
                };
            </script>
        </head>
        <body>
            <button id="demo">Demo</button>
        </body>
    </html>
`;

// mostly copied from src/utils/WidgetUtils.waitForRoomWidget with small modifications
async function waitForRoomWidget(client: Client, widgetId: string, roomId: string, add: boolean): Promise<void> {
    await client.evaluate(
        (matrixClient, { widgetId, roomId, add }) => {
            return new Promise<void>((resolve, reject) => {
                function eventsInIntendedState(evList: MatrixEvent[]) {
                    const widgetPresent = evList.some((ev) => {
                        return ev.getContent() && ev.getContent()["id"] === widgetId;
                    });
                    if (add) {
                        return widgetPresent;
                    } else {
                        return !widgetPresent;
                    }
                }

                const room = matrixClient.getRoom(roomId);

                const startingWidgetEvents = room.currentState.getStateEvents("im.vector.modular.widgets");
                if (eventsInIntendedState(startingWidgetEvents)) {
                    resolve();
                    return;
                }

                function onRoomStateEvents(ev: MatrixEvent) {
                    if (ev.getRoomId() !== roomId || ev.getType() !== "im.vector.modular.widgets") return;

                    const currentWidgetEvents = room.currentState.getStateEvents("im.vector.modular.widgets");

                    if (eventsInIntendedState(currentWidgetEvents)) {
                        matrixClient.removeListener("RoomState.events" as RoomStateEvent.Events, onRoomStateEvents);
                        resolve();
                    }
                }

                matrixClient.on("RoomState.events" as RoomStateEvent.Events, onRoomStateEvents);
            });
        },
        { widgetId, roomId, add },
    );
}

test.describe("Widget PIP", () => {
    test.use({
        displayName: "Mike",
        botCreateOpts: { displayName: "Bot", autoAcceptInvites: false },
    });

    let demoWidgetUrl: string;
    test.beforeEach(async ({ webserver }) => {
        demoWidgetUrl = webserver.start(DEMO_WIDGET_HTML);
    });

    for (const userRemove of ["leave", "kick", "ban"] as const) {
        test(`should be closed on ${userRemove}`, async ({ page, app, bot, user }) => {
            const roomId = await app.client.createRoom({
                name: ROOM_NAME,
                invite: [bot.credentials.userId],
            });

            // sets bot to Admin and user to Moderator
            await app.client.sendStateEvent(roomId, "m.room.power_levels", {
                users: {
                    [user.userId]: 50,
                    [bot.credentials.userId]: 100,
                },
            });

            // bot joins the room
            await bot.joinRoom(roomId);

            // setup widget via state event
            const content: IWidget = {
                id: DEMO_WIDGET_ID,
                creatorUserId: "somebody",
                type: DEMO_WIDGET_TYPE,
                name: DEMO_WIDGET_NAME,
                url: demoWidgetUrl,
            };
            await app.client.sendStateEvent(roomId, "im.vector.modular.widgets", content, DEMO_WIDGET_ID);

            // open the room
            await app.viewRoomByName(ROOM_NAME);

            // wait for widget state event
            await waitForRoomWidget(app.client, DEMO_WIDGET_ID, roomId, true);

            // activate widget in pip mode
            await page.evaluate(
                ({ widgetId, roomId }) => {
                    window.mxActiveWidgetStore.setWidgetPersistence(widgetId, roomId, true);
                },
                {
                    widgetId: DEMO_WIDGET_ID,
                    roomId,
                },
            );

            // checks that pip window is opened
            await expect(page.locator(".mx_WidgetPip")).toBeVisible();

            // checks that widget is opened in pip
            const iframe = page.frameLocator(`iframe[title="${DEMO_WIDGET_NAME}"]`);
            await expect(iframe.locator("#demo")).toBeVisible();

            const userId = user.userId;
            if (userRemove == "leave") {
                await app.client.leave(roomId);
            } else if (userRemove == "kick") {
                await bot.kick(roomId, userId);
            } else if (userRemove == "ban") {
                await bot.ban(roomId, userId);
            }

            // checks that pip window is closed
            await expect(iframe.locator(".mx_WidgetPip")).not.toBeVisible();
        });
    }
});
