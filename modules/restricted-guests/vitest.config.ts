/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineProject } from "vitest/config";

export default defineProject({
    test: {
        exclude: ["./e2e/**/*", "./node_modules/**/*"],
    },
});
