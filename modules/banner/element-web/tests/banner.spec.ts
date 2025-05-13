/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../../../playwright/element-web-test.ts";
import { ModuleConfig } from "../src/config.ts";

test.describe("Banner", () => {
    test.use({
        displayName: "Timmy",
        page: async ({ context, page, moduleDir }, use) => {
            for (const path of ["logo.svg", "app1.png", "app2.png", "opendesk/"]) {
                await context.route(`/${path}*`, async (route) => {
                    const file = new URL(route.request().url()).pathname;
                    await route.fulfill({ path: `${moduleDir}/tests/fixture/${file}` });
                });
            }
            await context.route("http://localhost:8080/ics/navigation.json*", async (route) => {
                await route.fulfill({
                    path: `${moduleDir}/tests/fixture/navigation.json`,
                    contentType: "application/json",
                });
            });
            await context.route("http://localhost:8080/ics/silent", async (route) => {
                await route.fulfill({ path: `${moduleDir}/tests/fixture/silent/index.html`, contentType: "text/html" });
            });

            await page.goto("/");
            await use(page);
        },
    });

    test("should error if config is missing", { tag: ["@screenshot"] }, async ({ page }) => {
        await expect(page.getByText("Your Element is misconfigured")).toBeVisible();
        // We don't take a screenshot as we don't want to assert Element's styling, only our own
    });

    const configs: ModuleConfig[] = [
        {
            logo_url: "http://localhost:8080/logo.svg",
            logo_link_url: "https://example.com/portal",
            menu: {
                type: "static",
                categories: [
                    {
                        name: "Applications",
                        links: [
                            {
                                icon_uri: "http://localhost:8080/app1.png",
                                name: "App 1",
                                link_url: "https://example.com/app1",
                                target: "app1",
                            },
                            {
                                icon_uri: "http://localhost:8080/app2.png",
                                name: "Riot",
                                link_url: "https://riot.im/app",
                                target: "riot-im",
                            },
                        ],
                    },
                    {
                        name: "Links",
                        links: [
                            {
                                icon_uri: "http://localhost:8080/app1.png",
                                name: "Link",
                                link_url: "https://example.com/link1",
                            },
                        ],
                    },
                ],
            },
        },
        {
            logo_url: "http://localhost:8080/opendesk/logomark.svg",
            logo_link_url: "https://example.com/portal",
            menu: {
                type: "univention",
                logo_url: "http://localhost:8080/opendesk/logofull.svg",
                ics_url: "http://localhost:8080/ics/",
            },
        },
    ];

    for (const config of configs) {
        const type = config.menu.type;

        test.describe(`${type} config`, () => {
            test.use({
                config: {
                    "io.element.element-web-modules.banner": config,
                },
            });

            test("should render", { tag: ["@screenshot"] }, async ({ page, axe }) => {
                await expect(page.getByRole("heading", { name: "Welcome to Element!" })).toBeVisible();
                await expect(page.getByLabel("Show portal")).toHaveAttribute("href", "https://example.com/portal");

                const nav = page.locator("nav");
                if (type === "univention") {
                    await expect(nav).toMatchScreenshot(`${type}_nav_loading.png`);
                    // The stub silent html doesn't seem to work in Playwright so send the postMessage manually
                    await page.evaluate(() => {
                        window.postMessage({
                            loggedIn: true,
                        });
                    });
                }

                const trigger = page.getByLabel("Show menu");
                await expect(trigger).toBeVisible();

                // Assert the banner looks as we expect
                await expect(nav).toMatchAriaSnapshot();
                await expect(nav).toMatchScreenshot(`${type}_nav.png`);

                // Check hover styles
                await trigger.hover();
                await expect(nav).toMatchScreenshot(`${type}_nav_hover.png`);

                await test.step("open menu", async () => {
                    await trigger.click();
                    const app1 = page.getByText("App 1");
                    await expect(app1).toHaveAttribute("href", "https://example.com/app1");
                    await app1.hover();

                    // Assert the sidebar looks as we expect
                    const sidebar = page.getByRole("dialog");
                    await expect(sidebar).toMatchAriaSnapshot();
                    await expect(page).toMatchScreenshot(`${type}_menu.png`, {
                        // We exclude this as we don't want to assert Element's styling, only our own
                        css: `
                        #matrixchat {
                            opacity: 0;
                            background: orchid;
                        }
                    `,
                    });
                });

                await test.step("close menu", async () => {
                    await expect(axe).toHaveNoViolations();

                    // Assert it closes by clicking the overlay
                    await page.getByTestId("dialog-overlay").click();
                    await expect(page.getByRole("dialog")).not.toBeVisible();
                });
            });
        });
    }
});
