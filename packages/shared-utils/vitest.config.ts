/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineProject } from "vitest/config";

import viteConfig from "./vite.config";

export default defineProject({
    test: {
        environment: "node",
        pool: "threads",
        globals: false,
        include: ["src/**/*.test.{ts,tsx}"],
    },
    define: viteConfig.define,
});
