/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "@element-hq/vite-common/vite.config.js";

export default mergeConfig(
    baseConfig,
    defineConfig({
        test: {
            coverage: {
                // The coverage report currently chokes on this file as it doesn't process it as TypeScript
                exclude: ["src/preload.cts"],
            },
            include: ["src/**/*.test.ts"],
        },
    }),
    true,
);
