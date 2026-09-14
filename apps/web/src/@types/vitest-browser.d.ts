/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Types for the browser-mode tests only: tsconfig.browser-test.json picks this file up
// and tsconfig.json excludes it, so none of it reaches the happy-dom tests.

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

declare global {
    // `favicon.ts` browser-sniffs these. Declared here rather than pulling in
    // src/@types/global.d.ts, which would drag most of the app into this program —
    // and with it the happy-dom tests, which would then see the browser matchers.
    interface Window {
        InstallTrigger?: unknown;
        opera?: unknown;
    }
}

export {};
