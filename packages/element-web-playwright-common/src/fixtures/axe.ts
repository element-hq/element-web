/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test as base } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const test = base.extend<{
    /**
     * AxeBuilder instance for the current page
     */
    axe: AxeBuilder;
}>({
    axe: async ({ page }, use) => {
        const builder = new AxeBuilder({ page });
        await use(builder);
    },
});
