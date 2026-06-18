/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Get the room list
 * @param page
 */
export function getRoomList(page: Page): Locator {
    return page.getByTestId("room-list");
}

/**
 * Get the room list header
 * @param page
 */
export function getRoomListHeader(page: Page): Locator {
    return page.getByTestId("room-list-header");
}

/**
 * Get a section header toggle button by section name
 * @param page
 * @param sectionName The display name of the section
 * @param isUnread Whether to look for the unread version of the section header
 */
export function getSectionHeader(page: Page, sectionName: string, isUnread = false): Locator {
    return getRoomList(page).getByRole("button", {
        name: isUnread ? `Toggle ${sectionName} section with unread rooms` : `Toggle ${sectionName} section`,
    });
}

/**
 * Asserts a room is nested under a specific section using the treegrid aria-level hierarchy.
 * Section header rows sit at aria-level=1; room rows nested within a section sit at aria-level=2.
 * Verifies that the closest preceding aria-level=1 row is the expected section header.
 */
export async function assertRoomInSection(page: Page, sectionName: string, roomName: string): Promise<void> {
    const roomList = getRoomList(page);
    const roomRow = roomList.getByRole("row", { name: `Open room ${roomName}` });
    // Room row must be at aria-level=2 (i.e. inside a section)
    await expect(roomRow).toHaveAttribute("aria-level", "2");
    // The closest preceding aria-level=1 row must be the expected section header.
    // XPath preceding:: axis returns nodes before the context in document order; [1] picks the nearest one.
    const closestSectionHeader = roomRow.locator(`xpath=preceding::*[@role="row" and @aria-level="1"][1]`);
    await expect(closestSectionHeader).toContainText(sectionName);
}

/**
 * Drag and drop a room row onto a section header
 * @param page
 * @param roomName
 * @param sectionName
 */
export async function dragRoomToSection(page: Page, roomName: string, sectionName: string): Promise<void> {
    const sourceRow = getRoomList(page).getByRole("row", { name: `Open room ${roomName}` });
    const source = sourceRow.locator("button").first();
    const target = getSectionHeader(page, sectionName);

    await expect(sourceRow).toBeVisible();
    await expect(source).toBeVisible();
    await expect(target).toBeVisible();

    const sourceBox = await getBoundingBox(source, `room ${roomName}`);
    const targetBox = await getBoundingBox(target, `section ${sectionName}`);

    const sourceX = sourceBox.x + sourceBox.width / 2;
    const sourceY = sourceBox.y + sourceBox.height / 2;
    const targetY = targetBox.y + targetBox.height / 2;

    // Grab the room
    await page.mouse.move(sourceX, sourceY);
    await page.mouse.down();
    //  Move the room on the section header
    await page.mouse.move(sourceX, targetY, { steps: 10 });
    // Drop the room
    await page.mouse.up();
}

/**
 * Wait for a locator to have stable viewport geometry and return its bounding box.
 *
 * Playwright's boundingBox() returns null when the element is not visible or is detached.
 * Room list updates are driven by sync and virtualization, so a newly-created room or
 * section can match the locator before it is ready for mouse coordinates.
 */
async function getBoundingBox(
    locator: Locator,
    description: string,
): Promise<NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>> {
    await locator.scrollIntoViewIfNeeded();
    await expect
        .poll(() => locator.boundingBox(), { message: `Expected ${description} to have a bounding box` })
        .not.toBeNull();

    const box = await locator.boundingBox();
    if (!box) {
        throw new Error(`Expected ${description} to have a bounding box`);
    }

    return box;
}

/**
 * Drag and drop a section header onto another section header. The dragged section is moved
 * relative to the target: dropped before the target when dragging up, after the target when
 * dragging down. Because the dnd start handler collapses every section, the layout changes
 * once the drag activates — so the target position is recomputed after activation rather
 * than cached up-front.
 */
export async function dragSectionToSection(
    page: Page,
    sourceSectionName: string,
    targetSectionName: string,
): Promise<void> {
    const source = getSectionHeader(page, sourceSectionName);
    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error(`Source section ${sourceSectionName} has no bounding box`);

    const sourceX = sourceBox.x + sourceBox.width / 2;
    const sourceY = sourceBox.y + sourceBox.height / 2;

    // Grab the section header
    await page.mouse.move(sourceX, sourceY);
    await page.mouse.down();
    // Move past the 5px PointerSensor activation threshold so the drag actually starts.
    // This triggers onSectionDragStart, which collapses all sections.
    await page.mouse.move(sourceX, sourceY + 10, { steps: 5 });

    // Re-query the target now that the layout has reflowed.
    const target = getSectionHeader(page, targetSectionName);
    const targetBox = await target.boundingBox();
    if (!targetBox) throw new Error(`Target section ${targetSectionName} has no bounding box`);
    const targetY = targetBox.y + targetBox.height / 2;

    // Move onto the (possibly relocated) target section header and drop.
    await page.mouse.move(sourceX, targetY, { steps: 10 });
    await page.mouse.up();
}

/**
 * Assert the displayed section headers appear in the given top-to-bottom order.
 */
export async function assertSectionsOrder(page: Page, expectedOrder: string[]): Promise<void> {
    const positions: Array<{ name: string; y: number }> = [];
    for (const name of expectedOrder) {
        const header = getSectionHeader(page, name);
        await expect(header).toBeVisible();
        const box = await header.boundingBox();
        if (!box) throw new Error(`Section ${name} has no bounding box`);
        positions.push({ name, y: box.y });
    }
    for (let i = 1; i < positions.length; i++) {
        expect(positions[i].y).toBeGreaterThan(positions[i - 1].y);
    }
}

/**
 * Get the primary filters container
 * @param page
 */
export function getPrimaryFilters(page: Page): Locator {
    return page.getByTestId("primary-filters");
}

/**
 * Get the room options menu button in the room list header
 * @param page
 */
export function getRoomOptionsMenu(page: Page): Locator {
    return page.getByRole("button", { name: "Room Options" });
}

/**
 * Get the filter list expand button in the room list header
 * @param page
 */
export function getFilterExpandButton(page: Page): Locator {
    return getPrimaryFilters(page).getByRole("button", { name: "Expand filter list" });
}

/**
 * Get the filter list collapse button in the room list header
 * @param page
 */
export function getFilterCollapseButton(page: Page): Locator {
    return getPrimaryFilters(page).getByRole("button", { name: "Collapse filter list" });
}

/**
 * Get the header section of the room list
 * @param page
 */
export function getHeaderSection(page: Page) {
    return page.getByTestId("room-list-header");
}

/**
 * Get the room list view
 * @param page
 */
export function getRoomListView(page: Page) {
    return page.getByRole("navigation", { name: "Room list" });
}

/**
 * Get the search section of the room list
 * @param page
 */
export function getSearchSection(page: Page) {
    return page.getByRole("search");
}
