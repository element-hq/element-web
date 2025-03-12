/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type SynapseContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers";

import { test, expect } from "../../../../playwright/element-web-test.ts";

declare module "@element-hq/element-web-module-api" {
    interface Config {
        "net.nordeck.element_web.module.opendesk": {
            config: {
                banner: {
                    ics_navigation_json_url: string;
                    ics_silent_url: string;
                    portal_logo_svg_url: string;
                    portal_url: string;
                };
                custom_css_variables: {
                    [key: `--cpd-${string}`]: string;
                };
            };
        };
        "net.nordeck.element_web.module.widget_toggles": {
            config: {
                types: string[];
            };
        };
        "net.nordeck.element_web.module.widget_lifecycle": {
            widget_permissions: {
                [url: string]: {
                    preload_approved: boolean;
                    identity_approved: boolean;
                    capabilities_approved: string[];
                };
            };
        };
    }
}

test.use({
    displayName: "Timmy",
    synapseConfig: async ({ synapseConfig, _homeserver: homeserver }, use) => {
        // Required for widget lifecycle test
        (homeserver as SynapseContainer).withConfigField("listeners[0].resources[0].names", ["client", "openid"]);
        await use(synapseConfig);
    },
    page: async ({ context, page, moduleDir }, use) => {
        for (const path of ["logo.svg", "app1.png", "app2.png"]) {
            await context.route(`/${path}*`, async (route) => {
                await route.fulfill({ path: `${moduleDir}/tests/fixture/${path}` });
            });
        }
        await context.route("http://localhost:8080/ics/navigation.json*", async (route) => {
            await route.fulfill({
                path: `${moduleDir}/tests/fixture/navigation.json`,
                contentType: "application/json",
            });
        });
        await context.route("http://localhost:8080/ics/silent", async (route) => {
            await route.fulfill({ path: `${moduleDir}/tests/fixture/silent-login.html`, contentType: "text/html" });
        });
        await context.route("http://localhost:8080/widget.html*", async (route) => {
            await route.fulfill({ path: `${moduleDir}/tests/fixture/widget.html`, contentType: "text/html" });
        });

        await page.goto("/");
        await use(page);
    },
    config: {
        "net.nordeck.element_web.module.opendesk": {
            config: {
                banner: {
                    ics_navigation_json_url: "http://localhost:8080/ics/navigation.json",
                    ics_silent_url: "http://localhost:8080/ics/silent",
                    portal_logo_svg_url: "http://localhost:8080/logo.svg",
                    portal_url: "https://example.com/portal",
                },

                custom_css_variables: {
                    "--cpd-color-text-action-accent": "purple",
                },
            },
        },
        "net.nordeck.element_web.module.widget_toggles": {
            config: {
                types: [],
            },
        },
        "net.nordeck.element_web.module.widget_lifecycle": {
            widget_permissions: {
                "http://localhost:8080/widget.html": {
                    preload_approved: true,
                    identity_approved: true,
                    capabilities_approved: ["org.matrix.msc2762.receive.state_event:m.room.topic"],
                },
            },
        },
        "net.nordeck.element_web.module.guest": {
            config: {
                guest_user_homeserver_url: "https://matrix.local/",
            },
        },
    },
});

test.describe("Opendesk", () => {
    test("should render top-bar", { tag: ["@screenshot"] }, async ({ page }) => {
        await expect(page.getByRole("heading", { name: "Welcome to Element!" })).toBeVisible();
        await expect(page.getByLabel("Show portal")).toHaveAttribute("href", "https://example.com/portal");

        const nav = page.locator("nav");
        await expect(nav).toMatchScreenshot(`nav_loading.png`);
        // The stub silent html doesn't seem to work in Playwright so send the postMessage manually
        await page.evaluate(() => {
            window.postMessage({
                loggedIn: true,
            });
        });

        const trigger = page.getByLabel("Show menu");
        await expect(trigger).toBeVisible();

        // Assert the banner looks as we expect
        await expect(nav).toMatchAriaSnapshot();
        await expect(nav).toMatchScreenshot(`nav.png`);

        // Check hover styles
        await trigger.hover();
        await expect(nav).toMatchScreenshot(`nav_hover.png`);

        await test.step("open menu", async () => {
            await trigger.click();
            const app1 = page.getByRole("link", { name: "App 1" });
            await expect(app1).toHaveAttribute("href", "https://example.com/app1");
            await app1.hover();

            // Assert the sidebar looks as we expect
            await expect(page.getByTestId("menu-list")).toMatchAriaSnapshot();
            await expect(page).toMatchScreenshot(`menu.png`, {
                // We exclude this as we don't want to assert Element's styling, only our own
                css: `
                    .mx_AuthPage {
                        opacity: 0;
                    }
                `,
            });
        });

        await test.step("close menu", async () => {
            // Assert it closes by clicking the overlay
            await page.getByTestId("menu-backdrop").click();
            await expect(page.getByTestId("menu-list")).not.toBeVisible();
        });
    });

    test("should apply custom_css_variables", async ({ page, user }) => {
        await expect(page.getByRole("button", { name: "Send a Direct Message" })).toHaveCSS(
            "background-color",
            "rgb(128, 0, 128)",
        ); // -> purple
    });

    test("should show the widget without any permission requests", async ({ page, user, homeserver }) => {
        const bot = await homeserver.registerUser("bot", "password", "Bot");
        const { room_id: roomId } = await homeserver.csApi.request<{ room_id: string }>(
            "POST",
            "/v3/createRoom",
            bot.accessToken,
            {
                name: "Trusted Widget",
            },
        );
        await homeserver.csApi.request<{
            event_id: string;
        }>("PUT", `/v3/rooms/${encodeURIComponent(roomId)}/state/im.vector.modular.widgets/1`, bot.accessToken, {
            id: "1",
            creatorUserId: bot.userId,
            type: "custom",
            name: "Trusted Widget",
            url: `http://localhost:8080/widget.html?hsUrl=${encodeURIComponent(homeserver.baseUrl)}`,
        });
        await homeserver.csApi.request(
            "PUT",
            `/v3/rooms/${encodeURIComponent(roomId)}/state/io.element.widgets.layout/`,
            bot.accessToken,
            {
                widgets: {
                    "1": {
                        container: "top",
                    },
                },
            },
        );
        await homeserver.csApi.request("POST", `/v3/rooms/${encodeURIComponent(roomId)}/invite`, bot.accessToken, {
            user_id: user.userId,
        });

        await page.getByText("Trusted Widget").click();
        await page.getByText("Accept").click();

        await expect(
            page.frameLocator(`iframe[title="Trusted Widget"]`).getByRole("heading", { name: `Hello ${user.userId}!` }),
        ).toBeVisible();
    });
});
