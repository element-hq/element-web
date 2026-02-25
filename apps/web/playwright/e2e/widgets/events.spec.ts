/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2022 Mikhail Aheichyk
Copyright 2022 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test } from "../../element-web-test";
import { waitForRoom } from "../utils";

const DEMO_WIDGET_ID = "demo-widget-id";
const DEMO_WIDGET_NAME = "Demo Widget";
const DEMO_WIDGET_TYPE = "demo";
const ROOM_NAME = "Demo";

const DEMO_WIDGET_HTML = `
    <html lang="en">
        <head>
            <title>Demo Widget</title>
            <script>
                let sendEventCount = 0
                window.onmessage = ev => {
                    if (ev.data.action === 'capabilities') {
                        window.parent.postMessage(Object.assign({
                            response: {
                                capabilities: [
                                    "org.matrix.msc2762.timeline:*",
                                    "org.matrix.msc2762.receive.state_event:m.room.topic",
                                    "org.matrix.msc2762.send.event:net.widget_echo"
                                ]
                            },
                        }, ev.data), '*');
                    } else if (ev.data.action === 'send_event' && !ev.data.response) {
                        // wraps received event into 'net.widget_echo' and sends back
                        sendEventCount += 1
                        window.parent.postMessage({
                            api: "fromWidget",
                            widgetId: ev.data.widgetId,
                            requestId: 'widget-' + sendEventCount,
                            action: "send_event",
                            data: {
                                type: 'net.widget_echo',
                                content: ev.data.data // sets matrix event to the content returned
                            },
                        }, '*')
                    }
                };
            </script>
        </head>
        <body>
            <button id="demo">Demo</button>
        </body>
    </html>
`;

test.describe("Widget Events", () => {
    test.use({
        displayName: "Mike",
        botCreateOpts: { displayName: "Bot", autoAcceptInvites: true },
    });

    let demoWidgetUrl: string;
    test.beforeEach(async ({ webserver }) => {
        demoWidgetUrl = webserver.start(DEMO_WIDGET_HTML);
    });

    test("should be updated if user is re-invited into the room with updated state event", async ({
        page,
        app,
        user,
        bot,
    }) => {
        const roomId = await app.client.createRoom({
            name: ROOM_NAME,
            invite: [bot.credentials.userId],
        });

        // setup widget via state event
        await app.client.sendStateEvent(
            roomId,
            "im.vector.modular.widgets",
            {
                id: DEMO_WIDGET_ID,
                creatorUserId: "somebody",
                type: DEMO_WIDGET_TYPE,
                name: DEMO_WIDGET_NAME,
                url: demoWidgetUrl,
            },
            DEMO_WIDGET_ID,
        );

        // set initial layout
        await app.client.sendStateEvent(
            roomId,
            "io.element.widgets.layout",
            {
                widgets: {
                    [DEMO_WIDGET_ID]: {
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

        // approve capabilities
        await page.locator(".mx_WidgetCapabilitiesPromptDialog").getByRole("button", { name: "Approve" }).click();

        // bot creates a new room with 'm.room.topic'
        const roomNew = await bot.createRoom({
            name: "New room",
            initial_state: [
                {
                    type: "m.room.topic",
                    state_key: "",
                    content: {
                        topic: "topic initial",
                    },
                },
            ],
        });

        await bot.inviteUser(roomNew, user.userId);

        // widget should receive 'm.room.topic' event after invite
        await waitForRoom(page, app.client, roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some(
                (e) =>
                    e.getType() === "net.widget_echo" &&
                    e.getContent().type === "m.room.topic" &&
                    e.getContent().content.topic === "topic initial",
            );
        });

        // update the topic
        await bot.sendStateEvent(
            roomNew,
            "m.room.topic",
            {
                topic: "topic updated",
            },
            "",
        );

        await bot.inviteUser(roomNew, user.userId);

        // widget should receive updated 'm.room.topic' event after re-invite
        await waitForRoom(page, app.client, roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some(
                (e) =>
                    e.getType() === "net.widget_echo" &&
                    e.getContent().type === "m.room.topic" &&
                    e.getContent().content.topic === "topic updated",
            );
        });
    });
});
