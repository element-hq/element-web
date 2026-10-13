/*
Copyright 2025-2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// We avoid using `mergeTests` because it drops useful type information about the fixtures.
// `config` is the top of our stack of extensions (it extends services, axe, etc), so it includes everything.
import { test } from "./config.js";
import type { TestType } from "@playwright/test";

// `Services` and `WorkerOptions` are exported to avoid breaking existing code.
// Prefer to use `WorkerArgs` in new code.
export { type Services, type WorkerOptions } from "./services.js";

export { test };

type FixtureTypes =
    typeof test extends TestType<infer TestArgs, infer WorkerArgs>
        ? [testArgs: TestArgs, workerArgs: WorkerArgs]
        : never;

/**
 * The test-scoped fixtures and options available to tests declared with {@link test}, including
 * Playwright's own (`page`, `context`, `request`, `browserName`, ...).
 */
export type TestFixtures = FixtureTypes[0];

/**
 * The worker-scoped fixtures and options available to tests declared with {@link test}, including
 * Playwright's own as well as our `Services` and `WorkerOptions`.
 */
export type WorkerArgs = FixtureTypes[1];

/**
 * Every fixture available as the first argument of the callback passed to {@link test}.
 */
export type CombinedTestFixtures = TestFixtures & WorkerArgs;
