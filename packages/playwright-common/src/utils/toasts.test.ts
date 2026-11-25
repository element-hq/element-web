/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { errors, type Page } from "@playwright/test";

import { rejectToastIfExists } from "./toasts.js";

/**
 * Mock a page with a single visible toast, whose button click behaves as given.
 */
function mockPage(click: () => Promise<void>, stillVisible: boolean): { page: Page; clickSpy: typeof click } {
    const clickSpy = vi.fn(click);
    const button = { click: clickSpy };
    const toast = {
        waitFor: vi.fn().mockResolvedValue(undefined),
        isVisible: vi.fn().mockResolvedValue(stillVisible),
        getByTestId: () => ({ locator: () => button }),
    };
    const page = { locator: () => ({ first: () => toast }) } as unknown as Page;
    return { page, clickSpy };
}

describe("rejectToastIfExists", () => {
    it("clicks the secondary button with a short timeout", async () => {
        const { page, clickSpy } = mockPage(async () => {}, true);

        await expect(rejectToastIfExists(page, "Notifications", { timeout: 50 })).resolves.toBe(true);
        expect(clickSpy).toHaveBeenCalledWith({ timeout: 2000 });
    });

    it("returns false if the toast disappears before it can be clicked", async () => {
        const { page } = mockPage(() => Promise.reject(new errors.TimeoutError("timed out")), false);

        await expect(rejectToastIfExists(page, "Verify this device", { timeout: 50 })).resolves.toBe(false);
    });

    it("throws if the click times out while the toast is still visible", async () => {
        const { page } = mockPage(() => Promise.reject(new errors.TimeoutError("timed out")), true);

        await expect(rejectToastIfExists(page, "Verify this device", { timeout: 50 })).rejects.toThrow(
            errors.TimeoutError,
        );
    });
});
