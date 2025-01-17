/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as YAML from "yaml";
import * as fs from "fs";

export type BuildConfig = {
    // Dev note: make everything here optional for user safety. Invalid
    // configs are very possible.

    // The module references to include in the build.
    modules?: string[];
};

export function readBuildConfig(): BuildConfig {
    if (fs.existsSync("./build_config.yaml")) {
        return YAML.parse(fs.readFileSync("./build_config.yaml", "utf-8"));
    }
    return {}; // no config
}
