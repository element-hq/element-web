/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Page, expect, Locator } from "@playwright/test";

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
        await toast.locator(".mx_Toast_buttons .mx_AccessibleButton_kind_primary").click();
    }

    /**
     * Reject a toast with the given title, only works for the first toast in the stack
     *
     * @param expectedTitle - Expected title of the toast
     */
    public async rejectToast(expectedTitle: string): Promise<void> {
        const toast = await this.getToast(expectedTitle);
        await toast.locator(".mx_Toast_buttons .mx_AccessibleButton_kind_danger_outline").click();
    }
}
