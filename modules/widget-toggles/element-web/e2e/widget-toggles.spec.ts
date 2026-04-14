/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";
import { type Credentials } from "@element-hq/element-web-playwright-common/lib/utils/api";
import { type StartedHomeserverContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers/HomeserverContainer";
import { type Container } from "@element-hq/element-web-module-api";

import { test as base, expect } from "../../../../playwright/element-web-test.ts";

const test = base.extend<{
    // Resolver for when to respond to the navigation.json request
    navigationJsonResolver: PromiseWithResolvers<void>;
}>({
    navigationJsonResolver: async ({}, use) => {
        await use(Promise.withResolvers<void>());
    },
});

const TEST_WIDGET_NAME = "Name of the test widget";

async function makeRoomWithWidgetAndGoTo(
    homeserver: StartedHomeserverContainer,
    user: Credentials,
    page: Page,
    avatarUrl?: string,
): Promise<string> {
    const { room_id: roomId } = await homeserver.csApi.request<{ room_id: string }>(
        "POST",
        "/v3/createRoom",
        user.accessToken,
        {
            name: "Come on in we've got widgets",
        },
    );
    await homeserver.csApi.request<{
        event_id: string;
    }>("PUT", `/v3/rooms/${encodeURIComponent(roomId)}/state/im.vector.modular.widgets/1`, user.accessToken, {
        id: "1",
        creatorUserId: user.userId,
        type: "m.custom",
        name: TEST_WIDGET_NAME,
        url: `http://localhost:8080/widget.html`,
        avatar_url: avatarUrl,
    });

    await page.goto(`/#/room/${roomId}`);

    return roomId;
}

async function moveWidgetToContainer(
    homeserver: StartedHomeserverContainer,
    user: Credentials,
    roomId: string,
    container: Container,
): Promise<void> {
    await homeserver.csApi.request(
        "PUT",
        `/v3/user/${encodeURIComponent(user.userId)}/rooms/${encodeURIComponent(roomId)}/account_data/im.vector.web.settings`,
        user.accessToken,
        {
            "Widgets.layout": {
                widgets: {
                    "1": { container },
                },
            },
        },
    );
}

test.describe("widget-toggles", () => {
    test.use({
        displayName: "Timmy",
        page: async ({ context, page, moduleDir }, use) => {
            await context.route("http://localhost:8080/widget.html*", async (route) => {
                await route.fulfill({ path: `${moduleDir}/e2e/fixture/widget.html`, contentType: "text/html" });
            });

            await context.route("http://localhost:8080/wigeon.png", async (route) => {
                await route.fulfill({ path: `${moduleDir}/e2e/fixture/wigeon.png`, contentType: "image/png" });
            });

            await page.goto("/");
            await use(page);
        },
    });

    test("should error if config is missing", async ({ page }) => {
        await expect(page.getByText("Your Element is misconfigured")).toBeVisible();
        await expect(page.getByText("Errors in module configuration")).toBeVisible();
        // We don't take a screenshot as we don't want to assert Element's styling, only our own
    });

    test.describe("with correct config", () => {
        test.use({
            config: {
                "io.element.element-web-modules.widget-toggles": {
                    types: ["m.custom"],
                },
            },
        });

        test(
            "should render 'show' button for widget not in top",
            { tag: ["@screenshot"] },
            async ({ homeserver, page, user }) => {
                await makeRoomWithWidgetAndGoTo(homeserver, user, page);

                await expect(page.getByRole("button", { name: "Show " + TEST_WIDGET_NAME })).toBeVisible();
            },
        );

        test(
            "should render 'hide' button for widget in top",
            { tag: ["@screenshot"] },
            async ({ homeserver, page, user }) => {
                const roomId = await makeRoomWithWidgetAndGoTo(homeserver, user, page);

                await moveWidgetToContainer(homeserver, user, roomId, "top");

                await expect(page.getByRole("button", { name: "Hide " + TEST_WIDGET_NAME })).toBeVisible();
            },
        );

        test("should move widget to top when 'show' button is clicked", async ({ homeserver, page, user }) => {
            await makeRoomWithWidgetAndGoTo(homeserver, user, page);

            await page.getByRole("button", { name: "Show " + TEST_WIDGET_NAME }).click();
            await expect(page.getByRole("button", { name: "Hide " + TEST_WIDGET_NAME })).toBeVisible();

            await expect(page.locator('iframe[title="Name of the test widget"]')).toBeVisible();
        });

        test("should move widget to left when 'hide' button is clicked", async ({ homeserver, page, user }) => {
            const roomId = await makeRoomWithWidgetAndGoTo(homeserver, user, page);
            await moveWidgetToContainer(homeserver, user, roomId, "top");

            await expect(page.locator('iframe[title="Name of the test widget"]')).toBeVisible();

            await page.getByRole("button", { name: "Hide " + TEST_WIDGET_NAME }).click();

            await expect(page.locator('iframe[title="Name of the test widget"]')).not.toBeVisible();
        });

        test("uses widget icon for button image if present", async ({ homeserver, page, user }) => {
            await makeRoomWithWidgetAndGoTo(homeserver, user, page, "mxc://fakehomeserver/fake_content_id");

            await expect(
                page.getByRole("button", { name: "Show " + TEST_WIDGET_NAME }).getByRole("img"),
            ).toHaveAttribute("src", /\/_matrix\/media\/v3\/download\/fakehomeserver\/fake_content_id$/);
        });

        test(
            "uses built in icon for widgets with no avatar",
            { tag: ["@screenshot"] },
            async ({ homeserver, page, user }) => {
                await makeRoomWithWidgetAndGoTo(homeserver, user, page);

                await expect(page.getByRole("button", { name: "Show " + TEST_WIDGET_NAME })).toMatchScreenshot(
                    "widget-toggle-button-default-icon.png",
                );
            },
        );
    });
});
