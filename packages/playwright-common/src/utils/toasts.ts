/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Assert that no toasts exist
 *
 * @public
 * @param page - Playwright page we are working with
 */
export async function assertNoToasts(page: Page): Promise<void> {
    await expect(page.locator(".mx_Toast_toast")).not.toBeVisible();
}

/**
 * Assert that a toast with the given title exists, and return it
 *
 * @public
 * @param page - Playwright page we are working with
 * @param title - Expected title of the toast
 * @param timeout - Time to retry the assertion for in milliseconds.
 *                  Defaults to `timeout` in `TestConfig.expect`.
 * @returns the Locator for the matching toast
 */
export async function getToast(page: Page, title: string, timeout?: number): Promise<Locator> {
    const toast = getToastIfExists(page, title);
    await expect(toast).toBeVisible({ timeout });
    return toast;
}

/**
 * Find a toast with the given title, if it exists.
 *
 * @public
 * @param page - Playwright page we are working with
 * @param title - Title of the toast.
 * @returns the Locator for the matching toast, or an empty locator if it
 *          doesn't exist.
 */
export function getToastIfExists(page: Page, title: string): Locator {
    return page.locator(".mx_Toast_toast", { hasText: title }).first();
}

/**
 * Accept a toast with the given title. Only works for the first toast in
 * the stack.
 *
 * @public
 * @param page - Playwright page we are working with
 * @param title - Expected title of the toast
 */
export async function acceptToast(page: Page, title: string): Promise<void> {
    const toast = await getToast(page, title);
    await toast.locator('.mx_Toast_buttons button[data-kind="primary"]').click();
}
/**
 * Accept a toast with the given title, if it exists. Only works for the
 * first toast in the stack.
 *
 * @public
 * @param page - Playwright page we are working with
 * @param title - Title of the toast
 */
export async function acceptToastIfExists(page: Page, title: string): Promise<void> {
    const toast = getToastIfExists(page, title).locator('.mx_Toast_buttons button[data-kind="primary"]');
    if ((await toast.count()) > 0) {
        await toast.click();
    }
}

/**
 * Reject a toast with the given title. Only works for the first toast in
 * the stack.
 *
 * @public
 * @param page - Playwright page we are working with
 * @param title - Expected title of the toast
 */
export async function rejectToast(page: Page, title: string): Promise<void> {
    const toast = await getToast(page, title);
    await toast.locator('.mx_Toast_buttons button[data-kind="secondary"]').click();
}

/**
 * Reject a toast with the given title, if it exists. Only works for the
 * first toast in the stack.
 *
 * @public
 * @param page - Playwright page we are working with
 * @param title - Title of the toast
 */
export async function rejectToastIfExists(page: Page, title: string): Promise<void> {
    const toast = getToastIfExists(page, title).locator('.mx_Toast_buttons button[data-kind="secondary"]');
    if ((await toast.count()) > 0) {
        await toast.click();
    }
}
