/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import type { Page } from "playwright-core";
import { test as base } from "./toasts.js";

export const test = base.extend<{
    /**
     * Whether the left panel should have its width fixed.
     * This is done because the library that we use for rendering collapsible
     * panels uses math to calculate the width which can sometimes leads to +/-1px
     * difference. While this does not matter to the user, it can lead to screenshot
     * tests failing.
     * Defaults to true, should be set to false via {@link base.use} when you want to test the collapse
     * behaviour.
     */
    lockLeftPanelWidth: boolean;
}>({
    lockLeftPanelWidth: true,
    page: async ({ lockLeftPanelWidth, page }, use) => {
        const listener = async (page: Page) => {
            await page.addStyleTag({
                content: `
                        #left-panel {
                            flex: 0 0 369.6875px !important;
                        }
                `,
            });
        };
        if (lockLeftPanelWidth) page.on("load", listener);
        await use(page);
        if (lockLeftPanelWidth) page.off("load", listener);
    },
});
