/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mergeConfig } from "vitest/config";

import baseConfig from "@element-hq/vite-common/vite.config";

export default mergeConfig(baseConfig, {
    test: {
        projects: ["widget-lifecycle", "widget-toggles"],
    },
});
