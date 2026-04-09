/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export { type Services, type WorkerOptions } from "./services.js";

// We avoid using `mergeTests` because it drops useful type information about the fixtures.
// `user` is the top of our stack of extensions (it extends services, axe, etc), so it includes everything.
export { test } from "./user.js";
