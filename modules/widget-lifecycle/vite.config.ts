/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vitest/config";
import baseConfig from "@element-hq/element-web-module-api/vite.base.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default mergeConfig(baseConfig, {
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "element-web-module-widget-lifecycle",
            fileName: "index",
            formats: ["es"],
        },
    },
});
