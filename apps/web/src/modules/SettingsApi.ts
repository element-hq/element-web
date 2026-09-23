/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { SettingsApi as ISettingsApi } from "@element-hq/element-web-module-api";
import SettingsStore from "../settings/SettingsStore";

export class SettingsApi implements ISettingsApi {
    public getValue<T = any>(settingName: string, roomId?: string | null, excludeDefault?: boolean): T | undefined {
        //@ts-expect-error: SettingsStore.getValue will throw on an invalid setting name anyway.
        return SettingsStore.getValue(settingName, roomId, excludeDefault);
    }
}
