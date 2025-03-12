/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mergeTests } from "@playwright/test";

import { test as axe } from "./axe.js";
import { test as user } from "./user.js";

export { type Services, type WorkerOptions } from "./services.js";

export const test = mergeTests(axe, user);
