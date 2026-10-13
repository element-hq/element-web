/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { type ElementAppPage } from "../../../pages/ElementAppPage";

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
 * @param canBeDragged false if the room cannot be dragged, so the sections do not collapse
 */
export async function dragRoomToSection(
    page: Page,
    roomName: string,
    sectionName: string,
    canBeDragged = true,
): Promise<void> {
    const sourceRow = getRoomList(page).getByRole("row", { name: `Open room ${roomName}` });
    const source = sourceRow.locator("button").first();

    await expect(sourceRow).toBeVisible();
    await expect(source).toBeVisible();

    // The source is safe to cache because it is grabbed before the sections collapse.
    const sourceBox = await getBoundingBox(source, `room ${roomName}`);
    const sourceX = sourceBox.x + sourceBox.width / 2;
    const sourceY = sourceBox.y + sourceBox.height / 2;

    await startDrag(page, sourceX, sourceY, canBeDragged);

    // Re-query the target now that the sections have collapsed and the layout reflowed.
    const target = getSectionHeader(page, sectionName);
    const targetBox = await getBoundingBox(target, `section ${sectionName}`);
    const targetY = targetBox.y + targetBox.height / 2;

    //  Move the room on the section header
    await page.mouse.move(sourceX, targetY, { steps: 10 });
    // Drop the room
    await page.mouse.up();
}

async function startDrag(page: Page, x: number, y: number, waitForCollapse = true): Promise<void> {
    await page.mouse.move(x, y);
    await page.mouse.down();
    // Move past the 5px PointerSensor activation threshold so the drag actually starts.
    await page.mouse.move(x, y + 10, { steps: 5 });
    if (waitForCollapse) await expect(getRoomList(page).getByRole("row", { level: 2 })).toHaveCount(0);
}

/**
 * Wait for a locator to have stable viewport geometry and return its bounding box.
 *
 * Playwright's boundingBox() returns null when the element is not visible or is detached.
 * Room list updates are driven by sync and virtualization, so a newly-created room or
 * section can match the locator before it is ready for mouse coordinates, and its position
 * can still change while the list lays itself out again.
 */
async function getBoundingBox(
    locator: Locator,
    description: string,
): Promise<NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>> {
    await locator.scrollIntoViewIfNeeded();

    let box: Awaited<ReturnType<Locator["boundingBox"]>> = null;
    await expect
        .poll(
            async () => {
                const previous = box;
                box = await locator.boundingBox();
                return box !== null && JSON.stringify(box) === JSON.stringify(previous);
            },
            { message: `Expected ${description} to have a stable bounding box` },
        )
        .toBe(true);

    return box!;
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
    const sourceBox = await getBoundingBox(source, `section ${sourceSectionName}`);

    const sourceX = sourceBox.x + sourceBox.width / 2;
    const sourceY = sourceBox.y + sourceBox.height / 2;

    await startDrag(page, sourceX, sourceY);

    // Re-query the target now that the sections have collapsed and the layout reflowed.
    const target = getSectionHeader(page, targetSectionName);
    const targetBox = await getBoundingBox(target, `section ${targetSectionName}`);
    const targetY = targetBox.y + targetBox.height / 2;

    // Move onto the (possibly relocated) target section header and drop.
    await page.mouse.move(sourceX, targetY, { steps: 10 });
    await page.mouse.up();
}

/**
 * Assert the displayed section headers appear in the given top-to-bottom order.
 */
export async function assertSectionsOrder(page: Page, expectedOrder: string[]): Promise<void> {
    // Retry, as the sections are reordered asynchronously after a drop
    await expect(async () => {
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
    }).toPass();
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

/**
 * Create `count` filler rooms whose names sort alphabetically before any room named "zzz …",
 * so that under A-Z sorting they fill the top of the list and push the "zzz …" room below the fold.
 */
export async function createFillerRooms(app: ElementAppPage, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
        await app.client.createRoom({ name: `room ${String(i).padStart(2, "0")}` });
    }
}

/** Switch the room list to alphabetical sorting so room positions are deterministic. */
export async function sortAlphabetically(page: Page): Promise<void> {
    await getRoomOptionsMenu(page).click();
    await page.getByRole("menuitemradio", { name: "A-Z" }).click();
}
