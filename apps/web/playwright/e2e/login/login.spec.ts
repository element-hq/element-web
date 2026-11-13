/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";

import { expect, test } from "../../element-web-test";
import { logIntoElement } from "../crypto/utils.ts";

test.describe(`With force_verification: true`, () => {
    test.use({
        config: {
            force_verification: true,
        },
    });

    test("Can reload after login", async ({ page, credentials }) => {
        // The page should reload fine when going to the base client URL
        // Regression test for https://github.com/element-hq/element-web/issues/31203
        await logIntoElement(page, credentials);

        // We should auto-upload the E2EE keys, and show a welcome page
        await expect(page.getByRole("heading", { name: `Welcome ${credentials.displayName}` })).toBeVisible();

        await page.goto("/");

        await expect(page.getByRole("heading", { name: `Welcome ${credentials.displayName}` })).toBeVisible();
    });
});

/** Make the homeserver offer password login, and single sign-on with the given identity provider brands. */
async function offerIdentityProviders(page: Page, brands: string[]): Promise<void> {
    await page.route("**/_matrix/client/*/login", async (route, request) => {
        if (request.method() !== "GET") return route.fallback();
        await route.fulfill({
            json: {
                flows: [
                    { type: "m.login.password" },
                    {
                        type: "m.login.sso",
                        identity_providers: brands.map((brand) => ({ id: brand, name: brand, brand })),
                    },
                ],
            },
        });
    });
}

test.describe("SSO buttons", () => {
    test("should show several identity providers as a row of round buttons", async ({ page }) => {
        const brands = ["github", "gitlab", "google"];
        await offerIdentityProviders(page, brands);
        await page.goto("/#/login");

        await expect(page.getByTestId(`idp-${brands[0]}`)).toBeVisible();
        const boxes = await Promise.all(brands.map((brand) => page.getByTestId(`idp-${brand}`).boundingBox()));
        for (const box of boxes) {
            expect(box!.width).toBeCloseTo(box!.height, 0);
            expect(box!.y).toBeCloseTo(boxes[0]!.y, 0);
        }
    });
});
