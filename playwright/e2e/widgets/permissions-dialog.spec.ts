/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

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
                    }
                };
            </script>
        </head>
    </html>
`;

test.describe("Widger permissions dialog", () => {
    test.use({
        displayName: "Mike",
    });

    let demoWidgetUrl: string;
    test.beforeEach(async ({ webserver }) => {
        demoWidgetUrl = webserver.start(DEMO_WIDGET_HTML);
    });

    test(
        "should be updated if user is re-invited into the room with updated state event",
        { tag: "@screenshot" },
        async ({ page, app, user, axe }) => {
            const roomId = await app.client.createRoom({
                name: ROOM_NAME,
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

            axe.disableRules("color-contrast"); // XXX: Inheriting colour contrast issues from room view.
            await expect(axe).toHaveNoViolations();
            await expect(page.locator(".mx_WidgetCapabilitiesPromptDialog")).toMatchScreenshot(
                "widget-capabilites-prompt.png",
            );
        },
    );
});
