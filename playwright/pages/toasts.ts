/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page, expect, type Locator } from "@playwright/test";

export class Toasts {
    public constructor(private readonly page: Page) {}

    /**
     * Assert that a toast with the given title exists, and return it
     *
     * @param expectedTitle - Expected title of the toast
     * @returns the Locator for the matching toast
     */
    public async getToast(expectedTitle: string): Promise<Locator> {
        const toast = this.page.locator(".mx_Toast_toast", { hasText: expectedTitle }).first();
        await expect(toast).toBeVisible();
        return toast;
    }

    /**
     * Assert that no toasts exist
     */
    public async assertNoToasts(): Promise<void> {
        await expect(this.page.locator(".mx_Toast_toast")).not.toBeVisible();
    }

    /**
     * Accept a toast with the given title, only works for the first toast in the stack
     *
     * @param expectedTitle - Expected title of the toast
     */
    public async acceptToast(expectedTitle: string): Promise<void> {
        const toast = await this.getToast(expectedTitle);
        await toast.locator('.mx_Toast_buttons button[data-kind="primary"]').click();
    }

    /**
     * Reject a toast with the given title, only works for the first toast in the stack
     *
     * @param expectedTitle - Expected title of the toast
     */
    public async rejectToast(expectedTitle: string): Promise<void> {
        const toast = await this.getToast(expectedTitle);
        await toast.locator('.mx_Toast_buttons button[data-kind="secondary"]').click();
    }
}
