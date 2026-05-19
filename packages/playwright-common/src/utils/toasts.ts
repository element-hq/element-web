/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Assert that no toasts exist.
 *
 * @public
 * @param page - Playwright page we are working with.
 */
export async function assertNoToasts(page: Page): Promise<void> {
    await expect(page.locator(".mx_Toast_toast")).not.toBeVisible();
}

/**
 * Find the toast with the supplied title. Fail if it does not exist.
 *
 * @public
 * @param page - Playwright page we are working with.
 * @param title - Expected title of the toast.
 * @param timeout - Time in ms before we give up and decide the toast does
 *                  not exist.
 * @returns the Locator for the matching toast.
 */
export async function getToast(page: Page, title: string, timeout?: number): Promise<Locator> {
    const toast = page.locator(".mx_Toast_toast", { hasText: title }).first();
    await expect(toast).toBeVisible({ timeout });
    return toast;
}

/**
 * Find the toast with the supplied title, or return null if not found.
 *
 * @public
 * @param page - Playwright page we are working with.
 * @param title - Expected title of the toast.
 * @param timeout - Time in ms before we give up and decide the toast does
 *                  not exist.
 * @returns the Locator for the matching toast, or null if it does not exist.
 */
export async function getToastIfExists(page: Page, title: string, timeout = 2000): Promise<Locator | null> {
    const toast = page.locator(".mx_Toast_toast", { hasText: title }).first();
    try {
        await toast.waitFor({ state: "visible", timeout });
        return toast;
    } catch {
        return null;
    }
}

/**
 * Accept the toast with the supplied title, or fail if it does not exist.
 *
 * Only works if this toast is at the top of the stack of toasts.
 *
 * @public
 * @param page - Playwright page we are working with.
 * @param title - Expected title of the toast.
 */
export async function acceptToast(page: Page, title: string): Promise<void> {
    await clickToastButton(page, title, "primary");
}

/**
 * Accept the toast with the supplied title, if it exists, or return after 2
 * seconds if it is not found.
 *
 * Only works if this toast is at the top of the stack of toasts.
 *
 * @public
 * @param page - Playwright page we are working with.
 * @param title - Expected title of the toast.
 *
 * @returns true if the toast was found and the button was clicked, or false if the toast was not found (always returns true if `required` is true).
 */
export async function acceptToastIfExists(page: Page, title: string): Promise<boolean> {
    return await clickToastButton(page, title, "primary", 2000, false);
}

/**
 * Reject the toast with the supplied title, or fail if it does not exist.
 *
 * Only works if this toast is at the top of the stack of toasts.
 *
 * @public
 * @param page - Playwright page we are working with.
 * @param title - Expected title of the toast.
 */
export async function rejectToast(page: Page, title: string): Promise<void> {
    await clickToastButton(page, title, "secondary");
}

/**
 * Reject the toast with the supplied title, if it exists, or return after 2
 * seconds if it is not found.
 *
 * Only works if this toast is at the top of the stack of toasts.
 *
 * @public
 * @param page - Playwright page we are working with.
 * @param title - Expected title of the toast.
 * @param options.timeout - Time in ms before we give up and decide the toast does not exist.
 *
 * @returns true if the toast was found and the button was clicked, or false if the toast was not found (always returns true if `required` is true).
 */
export async function rejectToastIfExists(
    page: Page,
    title: string,
    options: { timeout?: number } = {},
): Promise<boolean> {
    const { timeout = 2000 } = options;
    return await clickToastButton(page, title, "secondary", timeout, false);
}

/**
 * Find the toast with the supplied title and click a button on it.
 *
 * Only works if this toast is at the top of the stack of toasts.
 *
 * If `required` is false, you should supply a relatively short `timeout`
 * (e.g. 2000, meaning 2 seconds) to prevent your test taking too long.
 *
 * @param page - Playwright page we are working with.
 * @param title - Expected title of the toast.
 * @param button - Which button to click on the toast. Allowed values are
 *                 "primary", which will accept the toast, or "secondary",
 *                 which will reject it.
 * @param timeout - Time in ms before we give up and decide the toast does
 *                  not exist. If `required` is true, defaults to `timeout`
 *                  in `TestConfig.expect`. Otherwise, defaults to 2000 (2
 *                  seconds).
 * @param required - If true, fail the test (throw an exception) if the
 *                   toast is not visible. Otherwise, just return after
 *                   `timeout` if the toast is not visible.
 * @returns true if the toast was found and the button was clicked, or false if the toast was not found (always returns true if `required` is true).
 */
async function clickToastButton(
    page: Page,
    title: string,
    button: "primary" | "secondary",
    timeout?: number,
    required = true,
): Promise<boolean> {
    let toast: Locator | null;
    if (required) {
        toast = await getToast(page, title, timeout);
    } else {
        toast = await getToastIfExists(page, title, timeout);
    }

    if (toast) {
        await toast.locator(`.mx_Toast_buttons button[data-kind="${button}"]`).click();
        return true;
    }
    return false;
}
