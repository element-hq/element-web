/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineProject } from "vitest/config";
import { importCSSSheet } from "@arcmantle/vite-plugin-import-css-sheet";

export default defineProject({
    // Turn `import style from "./style.css" with { type: "css" }` into a stylesheet, as in the build
    plugins: [importCSSSheet()],
    test: {
        exclude: ["./e2e/**/*", "./node_modules/**/*"],
        environment: "happy-dom",
        setupFiles: ["src/setupTests.ts"],
    },
});
