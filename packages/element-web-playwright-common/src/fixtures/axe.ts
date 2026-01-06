/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import AxeBuilder from "@axe-core/playwright";

import { test as base } from "./user.js";

// We want to avoid using `mergeTests` because it drops useful type information about the fixtures. Instead, we extend
// the definition of `test` from `user.ts`, so that there is a linear hierarchy.
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
