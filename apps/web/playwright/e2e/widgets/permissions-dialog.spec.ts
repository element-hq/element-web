/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { WIDGET_HOSTS } from "./widget-hosts";

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

for (const host of WIDGET_HOSTS) {
    test.describe(`Widget permissions dialog (${host.name})`, () => {
        test.use({
            displayName: "Mike",
            labsFlags: host.labsFlags,
        });

        let demoWidgetUrl: string;
        test.beforeEach(async ({ webserver }) => {
            demoWidgetUrl = webserver.start(DEMO_WIDGET_HTML);
        });

        test(
            "should be updated if user is re-invited into the room with updated state event",
            // The screenshot baseline belongs to the matrix-widget-api host; the MSC4412 host checks the dialog itself
            { tag: host.msc4412 ? [] : "@screenshot" },
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

                axe.disableRules(["color-contrast", "nested-interactive"]); // XXX: Inheriting colour contrast issues from room view.
                await expect(axe).toHaveNoViolations();
                const dialog = page.locator(".mx_WidgetCapabilitiesPromptDialog");
                if (host.msc4412) {
                    // The widget's own capabilities arrive through the compat wrapper; the wrapper's context
                    // capabilities are granted without a prompt.
                    await expect(dialog).toBeVisible();
                    await expect(dialog.getByRole("checkbox")).toHaveCount(3);
                } else {
                    await expect(dialog).toMatchScreenshot("widget-capabilites-prompt.png");
                }
            },
        );
    });
}
