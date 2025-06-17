/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { ConfigApi as IConfigApi, Config } from "@element-hq/element-web-module-api";
import SdkConfig from "../SdkConfig.ts";

export class ConfigApi implements IConfigApi {
    public get(): Config;
    public get<K extends keyof Config>(key: K): Config[K];
    public get<K extends keyof Config = never>(key?: K): Config | Config[K] {
        if (key === undefined) {
            return SdkConfig.get() as Config;
        }
        return SdkConfig.get(key);
    }
}
