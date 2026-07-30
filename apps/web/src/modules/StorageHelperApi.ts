/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { StorageHelperApi as IStorageHelperApi } from "@element-hq/element-web-module-api";
import PlatformPeg from "../PlatformPeg";

export class StorageHelperApi implements IStorageHelperApi {
    public async getPickleKey(userId: string, deviceId: string): Promise<string | null> {
        return PlatformPeg.get()!.getPickleKey(userId, deviceId);
    }
}
