/*
Copyright 2022 New Vector Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
    const configFile = process.env.ELEMENT_BUILD_CONFIG ?? "./build_config.yaml";
    if (fs.existsSync(configFile)) {
        return YAML.parse(fs.readFileSync(configFile, "utf-8"));
    }
    return {}; // no config
}
