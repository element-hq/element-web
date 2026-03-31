/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import { type SettingLevel } from "../SettingLevel";
import SettingsStore from "../SettingsStore";
import type { BooleanSettingKey } from "../Settings.tsx";

/**
 * Disables a setting & forces it's value if one or more settings are not enabled
 */
export default class RequiresSettingsController extends SettingController {
    public constructor(
        public readonly settingNames: BooleanSettingKey[],
        private forcedValue = false,
    ) {
        super();
    }

    public getValueOverride(
        _level: SettingLevel,
        _roomId: string,
        _calculatedValue: any,
        _calculatedAtLevel: SettingLevel | null,
    ): any {
        if (this.settingDisabled) {
            // per the docs: we force a disabled state when the feature isn't active
            return this.forcedValue;
        }
        return null; // no override
    }

    public get settingDisabled(): boolean {
        return this.settingNames.some((s) => !SettingsStore.getValue(s));
    }
}
