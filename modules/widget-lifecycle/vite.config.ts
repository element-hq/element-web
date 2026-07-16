/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mergeConfig } from "vitest/config";
import baseConfig from "@element-hq/element-web-module-api/vite.base.ts";

export default mergeConfig(baseConfig, {
    build: {
        lib: {
            entry: import.meta.resolve("src/index.ts"),
            name: "element-web-module-widget-lifecycle",
            fileName: "index",
            formats: ["es"],
        },
    },
});
