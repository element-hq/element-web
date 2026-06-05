/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { KnipConfig } from "knip";

// Specify this as knip loads config files which may conditionally add reporters, e.g. `vitest-sonar-reporter`
process.env.GITHUB_ACTIONS = "1";

export default {
    ignoreDependencies: [
        // Needed for lint:workflows
        "@action-validator/cli",
        "@action-validator/core",
        // Unlisted peer dependency for @element-hq/element-web-module-api
        "matrix-widget-api",
    ],
    ignoreBinaries: [
        // False positive for `yarn list`
        "list",
    ],
    workspaces: {
        "modules/*/element-web": {
            entry: "src/index.ts{x,}",
        },
    },
} satisfies KnipConfig;
