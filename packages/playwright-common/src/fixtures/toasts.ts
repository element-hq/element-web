/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect, type Locator, type Page } from "@playwright/test";

// We want to avoid using `mergeTests` in index.ts because it drops useful type
// information about the fixtures. Instead, we add `services` into our fixture
// suite by using its `test` as a base, so that there is a linear hierarchy.
import { test as base } from "./services.js";

// This fixture provides convenient handling of Element Web's toasts.
export const test = base.extend<{
    /**
     * Convenience functions for handling toasts.
     */
    toasts: Toasts;
}>({
    toasts: async ({ page }, use) => {
        const toasts = new Toasts(page);
        await use(toasts);
    },
});

class Toasts {
    public constructor(public readonly page: Page) {}

    /**
     * Assert that no toasts exist.
     */
    public async assertNoToasts(): Promise<void> {
        await expect(this.page.locator(".mx_Toast_toast")).not.toBeVisible();
    }

    /**
     * Return the toast with the supplied title. Fail or return null if it does
     * not exist.
     *
     * If `required` is false, you should supply a relatively short `timeout`
     * (e.g. 2000, meaning 2 seconds) to prevent your test taking too long.
     *
     * @param title - Expected title of the toast.
     * @param timeout - Time in ms before we give up and decide the toast does
     *                  not exist. If `required` is true, defaults to `timeout`
     *                  in `TestConfig.expect`. Otherwise, defaults to 2000 (2
     *                  seconds).
     * @param required - If true, fail the test (throw an exception) if the
     *                   toast is not visible. Otherwise, just return null if
     *                   the toast is not visible.
     * @returns the Locator for the matching toast, or null if it is not
     *          visible. (null will only be returned if `required` is false.)
     */
    public async getToast(title: string, timeout?: number, required = true): Promise<Locator | null> {
        const toast = this.page.locator(".mx_Toast_toast", { hasText: title }).first();

        if (required) {
            await expect(toast).toBeVisible({ timeout });
            return toast;
        } else {
            // If we don't set a timeout, waitFor will wait forever. Since
            // required is false, we definitely don't want to wait forever.
            timeout = timeout ?? 2000;

            try {
                await toast.waitFor({ state: "visible", timeout });
                return toast;
            } catch {
                return null;
            }
        }
    }

    /**
     * Accept the toast with the supplied title, or fail if it does not exist.
     *
     * Only works if this toast is at the top of the stack of toasts.
     *
     * @param title - Expected title of the toast.
     */
    public async acceptToast(title: string): Promise<void> {
        return await clickToastButton(this, title, "primary");
    }

    /**
     * Accept the toast with the supplied title, if it exists, or return after 2
     * seconds if it is not found.
     *
     * Only works if this toast is at the top of the stack of toasts.
     *
     * @param title - Expected title of the toast.
     */
    public async acceptToastIfExists(title: string): Promise<void> {
        return await clickToastButton(this, title, "primary", 2000, false);
    }

    /**
     * Reject the toast with the supplied title, or fail if it does not exist.
     *
     * Only works if this toast is at the top of the stack of toasts.
     *
     * @param title - Expected title of the toast.
     */
    public async rejectToast(title: string): Promise<void> {
        return await clickToastButton(this, title, "secondary");
    }

    /**
     * Reject the toast with the supplied title, if it exists, or return after 2
     * seconds if it is not found.
     *
     * Only works if this toast is at the top of the stack of toasts.
     *
     * @param title - Expected title of the toast.
     */
    public async rejectToastIfExists(title: string): Promise<void> {
        return await clickToastButton(this, title, "secondary", 2000, false);
    }
}

/**
 * Find the toast with the supplied title and click a button on it.
 *
 * Only works if this toast is at the top of the stack of toasts.
 *
 * If `required` is false, you should supply a relatively short `timeout`
 * (e.g. 2000, meaning 2 seconds) to prevent your test taking too long.
 *
 * @param toasts - A Toasts instance.
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
 */
async function clickToastButton(
    toasts: Toasts,
    title: string,
    button: "primary" | "secondary",
    timeout?: number,
    required = true,
): Promise<void> {
    const toast = await toasts.getToast(title, timeout, required);

    if (toast) {
        await toast.locator(`.mx_Toast_buttons button[data-kind="${button}"]`).click();
    }
}
