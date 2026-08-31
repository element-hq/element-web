/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

declare module "vitest" {
    interface ProvidedContext {
        /**
         * Whether the browser is rendering the same way CI does, and so whether the
         * committed screenshot baselines can be asserted against.
         * Provided by vitest.browser.config.ts.
         */
        canCompareScreenshots: boolean;
    }
}

export {};
