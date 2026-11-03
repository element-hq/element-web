/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { expect, onTestFinished } from "vitest";

/** Anything with a method which tears it down. */
type Teardownable = { dispose(): void } | { destroy(): void } | { stop(): void | Promise<void> };

/**
 * Tears `instance` down once the current test finishes, by calling its `dispose`, `destroy` or `stop` method.
 *
 * It may be called in a test or in its `beforeEach`. Instances shared across tests, created in `beforeAll` or a
 * `describe` body, still need tearing down in an `afterAll`.
 *
 * @example
 * const vm = tearDownAfterTest(new ResizerViewModel(CallStore.instance));
 */
export function tearDownAfterTest<T extends Teardownable>(instance: T): T {
    if (expect.getState().currentTestName === undefined) {
        throw new Error("tearDownAfterTest must be called while a test, or its beforeEach, is running");
    }
    onTestFinished(() => {
        if ("dispose" in instance) return instance.dispose();
        if ("destroy" in instance) return instance.destroy();
        return instance.stop();
    });
    return instance;
}
