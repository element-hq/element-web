/*
Copyright 2026 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

const PIP_ROOM_NAME = "PiP Room";
const PIP_WIDGET_ID = "pip-widget";
const PIP_WIDGET_NAME = "PiP Widget";

const MAXIMISED_ROOM_NAME = "Maximised Room";
const MAXIMISED_WIDGET_ID = "maximised-widget";
const MAXIMISED_WIDGET_NAME = "Maximised Widget";

const WIDGET_HTML = `
    <html lang="en">
        <head>
            <title>Widget</title>
        </head>
        <body>
            Hello World
        </body>
    </html>
`;

test.describe("Widget PiP overlay", () => {
    test.use({
        displayName: "Sally",
        // Leave enough room to move the PiP across the maximised widget by more than its own width
        viewport: { width: 1600, height: 900 },
    });

    test("should draw the PiP above a maximised widget and drag it across the widget", async ({
        page,
        app,
        user,
        webserver,
    }) => {
        const widgetUrl = webserver.start(WIDGET_HTML);

        // Room with the widget that will be shown in the PiP
        const pipRoomId = await app.client.createRoom({ name: PIP_ROOM_NAME });
        await app.client.sendStateEvent(
            pipRoomId,
            "im.vector.modular.widgets",
            { id: PIP_WIDGET_ID, creatorUserId: "somebody", type: "widget", name: PIP_WIDGET_NAME, url: widgetUrl },
            PIP_WIDGET_ID,
        );
        await app.client.sendStateEvent(
            pipRoomId,
            "io.element.widgets.layout",
            { widgets: { [PIP_WIDGET_ID]: { container: "top", index: 0, width: 100, height: 0 } } },
            "",
        );

        // Room with a maximised widget, which covers most of the screen
        const maximisedRoomId = await app.client.createRoom({ name: MAXIMISED_ROOM_NAME });
        await app.client.sendStateEvent(
            maximisedRoomId,
            "im.vector.modular.widgets",
            {
                id: MAXIMISED_WIDGET_ID,
                creatorUserId: "somebody",
                type: "widget",
                name: MAXIMISED_WIDGET_NAME,
                url: widgetUrl,
            },
            MAXIMISED_WIDGET_ID,
        );
        await app.client.sendStateEvent(
            maximisedRoomId,
            "io.element.widgets.layout",
            { widgets: { [MAXIMISED_WIDGET_ID]: { container: "center" } } },
            "",
        );

        // Make the widget persistent, then leave its room so that it moves into the PiP
        await app.viewRoomByName(PIP_ROOM_NAME);
        await expect(page.locator(`iframe[title="${PIP_WIDGET_NAME}"]`)).toBeVisible();
        await page.evaluate(
            ({ widgetId, roomId }) => {
                window.mxActiveWidgetStore.setWidgetPersistence(widgetId, roomId, true);
            },
            { widgetId: PIP_WIDGET_ID, roomId: pipRoomId },
        );

        await app.viewRoomByName(MAXIMISED_ROOM_NAME);
        const maximisedWidget = page.locator(`iframe[title="${MAXIMISED_WIDGET_NAME}"]`);
        await expect(maximisedWidget).toBeVisible();
        const pip = page.getByTestId("widget-pip-container");
        await expect(pip).toBeVisible();

        // Drag the PiP by its header over the left part of the maximised widget, and keep holding it there
        // since the PiP snaps back to a corner of the screen when released.
        const header = pip.getByText(PIP_ROOM_NAME);
        const headerBox = (await header.boundingBox())!;
        const widgetBox = (await maximisedWidget.boundingBox())!;
        const pointerY = widgetBox.y + widgetBox.height / 2;
        await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(widgetBox.x + 60, pointerY, { steps: 10 });

        // Once the PiP header is over the maximised widget, it must be the top-most element at its position,
        // and not the maximised widget's iframe
        await expect
            .poll(async () => {
                const box = await header.boundingBox();
                if (!box) return false;
                const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
                const overWidget =
                    point.x > widgetBox.x &&
                    point.x < widgetBox.x + widgetBox.width &&
                    point.y > widgetBox.y &&
                    point.y < widgetBox.y + widgetBox.height;
                if (!overWidget) return false;
                return page.evaluate(
                    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest("[data-testid='widget-pip-container']"),
                    point,
                );
            })
            .toBe(true);

        // Jump the pointer ahead of the PiP onto the maximised widget's iframe: the PiP must still follow it,
        // instead of the iframe swallowing the pointer events.
        const pointer = { x: widgetBox.x + widgetBox.width - 60, y: pointerY };
        const pipWrapper = page.locator(".mx_PictureInPictureDragger");
        expect(pointer.x - (widgetBox.x + 60)).toBeGreaterThan((await pipWrapper.boundingBox())!.width);
        await page.mouse.move(pointer.x, pointer.y);
        await expect
            .poll(async () => {
                const box = await pipWrapper.boundingBox();
                return (
                    !!box &&
                    pointer.x > box.x &&
                    pointer.x < box.x + box.width &&
                    pointer.y > box.y &&
                    pointer.y < box.y + box.height
                );
            })
            .toBe(true);

        await page.mouse.up();
    });
});
