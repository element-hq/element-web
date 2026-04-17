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
     * Assert that no toasts exist
     */
    public async assertNoToasts(): Promise<void> {
        await expect(this.page.locator(".mx_Toast_toast")).not.toBeVisible();
    }

    /**
     * Assert that a toast with the given title exists, and return it
     *
     * @param title - Expected title of the toast
     * @param timeout - Time to retry the assertion for in milliseconds.
     *                  Defaults to `timeout` in `TestConfig.expect`.
     * @returns the Locator for the matching toast
     */
    public async getToast(title: string, timeout?: number): Promise<Locator> {
        const toast = this.getToastIfExists(title);
        await expect(toast).toBeVisible({ timeout });
        return toast;
    }

    /**
     * Find a toast with the given title, if it exists.
     *
     * @param title - Title of the toast.
     * @returns the Locator for the matching toast, or an empty locator if it
     *          doesn't exist.
     */
    public getToastIfExists(title: string): Locator {
        return this.page.locator(".mx_Toast_toast", { hasText: title }).first();
    }

    /**
     * Accept a toast with the given title. Only works for the first toast in
     * the stack.
     *
     * @param title - Expected title of the toast
     */
    public async acceptToast(title: string): Promise<void> {
        const toast = await this.getToast(title);
        await toast.locator('.mx_Toast_buttons button[data-kind="primary"]').click();
    }
    /**
     * Accept a toast with the given title, if it exists. Only works for the
     * first toast in the stack.
     *
     * @param title - Title of the toast
     */
    public async acceptToastIfExists(title: string): Promise<void> {
        const toast = this.getToastIfExists(title).locator('.mx_Toast_buttons button[data-kind="primary"]');
        if ((await toast.count()) > 0) {
            await toast.click();
        }
    }

    /**
     * Reject a toast with the given title. Only works for the first toast in
     * the stack.
     *
     * @param title - Expected title of the toast
     */
    public async rejectToast(title: string): Promise<void> {
        const toast = await this.getToast(title);
        await toast.locator('.mx_Toast_buttons button[data-kind="secondary"]').click();
    }

    /**
     * Reject a toast with the given title, if it exists. Only works for the
     * first toast in the stack.
     *
     * @param title - Title of the toast
     */
    public async rejectToastIfExists(title: string): Promise<void> {
        const toast = this.getToastIfExists(title).locator('.mx_Toast_buttons button[data-kind="secondary"]');
        if ((await toast.count()) > 0) {
            await toast.click();
        }
    }
}
