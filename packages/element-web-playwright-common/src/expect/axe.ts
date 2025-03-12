/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect as baseExpect, type ExpectMatcherState, type MatcherReturnType } from "@playwright/test";

import type AxeBuilder from "@axe-core/playwright";

export type Expectations = {
    /**
     * Assert that the given AxeBuilder instance has no violations.
     * @param receiver - The AxeBuilder instance to check.
     */
    toHaveNoViolations: (this: ExpectMatcherState, receiver: AxeBuilder) => Promise<MatcherReturnType>;
};

export const expect = baseExpect.extend<Expectations>({
    async toHaveNoViolations(this: ExpectMatcherState, receiver: AxeBuilder) {
        const testInfo = test.info();
        if (!testInfo) throw new Error(`toHaveNoViolations() must be called during the test`);

        const results = await receiver.analyze();

        await testInfo.attach("accessibility-scan-results", {
            body: JSON.stringify(results, null, 2),
            contentType: "application/json",
        });

        baseExpect(results.violations).toEqual([]);

        return { pass: true, message: (): string => "", name: "toHaveNoViolations" };
    },
});
