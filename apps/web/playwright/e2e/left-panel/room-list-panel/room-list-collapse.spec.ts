/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { test, expect } from "../../../element-web-test";
import type { Locator, Page } from "playwright-core";

test.describe("Collapsible Room list", () => {
    test.use({
        displayName: "Alice",
        lockLeftPanelWidth: false,
    });

    test.beforeEach(async ({ page, app, user }) => {
        await app.closeNotificationToast();
        for (let i = 0; i < 10; i++) {
            await app.client.createRoom({ name: `room${i}` });
        }
    });

    /**
     * Resize the panel and return the bounding box
     * @param pixels The number of pixels by which to resize the panel
     */
    async function resize(page: Page, pixels: number): ReturnType<Locator["boundingBox"]> {
        const leftPanelLocator = page.getByTestId("left-panel");
        const boundingBox = await leftPanelLocator.boundingBox();

        // Move mouse 2px to the right of the left-panel, this should be region that the user drags to resize the panel.
        const mouseX = boundingBox.x + boundingBox.width + 2;
        const mouseY = boundingBox.y + boundingBox.height / 2;

        await page.mouse.move(mouseX, mouseY);
        await page.mouse.down();
        await page.mouse.move(mouseX + pixels, mouseY);

        return boundingBox;
    }

    test("should be possible to expand/contract the room list", { tag: "@screenshot" }, async ({ page, app, user }) => {
        await expect(page).toMatchScreenshot("room-list-collapse-default.png");
        const leftPanelLocator = page.getByTestId("left-panel");

        // Contract the panel
        let previousBoundingBox = await resize(page, -50);
        let currentBoundingBox = await leftPanelLocator.boundingBox();
        expect(currentBoundingBox.width).toBeCloseTo(previousBoundingBox.width - 50, 0);

        // Expand the panel
        previousBoundingBox = await resize(page, 30);
        currentBoundingBox = await leftPanelLocator.boundingBox();
        expect(currentBoundingBox.width).toBeCloseTo(previousBoundingBox.width + 30, 0);
    });

    test(
        "should be possible to fully collapse and expand the left panel",
        { tag: "@screenshot" },
        async ({ page, app, user }) => {
            const leftPanelLocator = page.getByTestId("left-panel");

            // Collapse the panel
            await resize(page, -300);
            let currentBoundingBox = await leftPanelLocator.boundingBox();
            expect(currentBoundingBox.width).toStrictEqual(0);

            // Expect te separator to be shown
            const separator = page.getByRole("separator", { name: "Click or drag to expand" });
            await expect(separator).toBeInViewport();
            await expect(page).toMatchScreenshot("room-list-collapse-fully-collapsed.png");

            // Should be possible to expand by clicking on the separator
            await separator.click();
            currentBoundingBox = await leftPanelLocator.boundingBox();
            expect(currentBoundingBox.width).toBeGreaterThan(365);

            // Collapse the panel again
            await resize(page, -300);

            // Check that the panel can be expanded by dragging the separator
            const separatorBoundingBox = await separator.boundingBox();
            const mouseX = separatorBoundingBox.x + separatorBoundingBox.width / 2;
            const mouseY = separatorBoundingBox.y + separatorBoundingBox.height / 2;
            await page.mouse.move(mouseX, mouseY);
            await page.mouse.down();
            await page.mouse.move(mouseX + 400, mouseY);
            expect(currentBoundingBox.width).toBeGreaterThan(365);
        },
    );
});
