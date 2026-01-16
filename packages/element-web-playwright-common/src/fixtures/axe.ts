/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test as base } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// This fixture is useful for simple component library tests that won't want any extra services like a homeserver, so we
// explicitly avoid pulling anything more than playwright's base fixtures in.
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
