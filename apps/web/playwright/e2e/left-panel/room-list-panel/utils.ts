/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Locator, type Page } from "@playwright/test";

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
    return getRoomList(page).getByRole("gridcell", {
        name: isUnread ? `Toggle ${sectionName} section with unread room(s)` : `Toggle ${sectionName} section`,
    });
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
