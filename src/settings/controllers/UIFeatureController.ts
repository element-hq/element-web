/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import { type SettingLevel } from "../SettingLevel";
import SettingsStore from "../SettingsStore";
import { type SettingKey } from "../Settings.tsx";

/**
 * Enforces that a boolean setting cannot be enabled if the corresponding
 * UI feature is disabled. If the UI feature is enabled, the setting value
 * is unchanged.
 *
 * Settings using this controller are assumed to return `false` when disabled.
 */
export default class UIFeatureController extends SettingController {
    public constructor(
        private uiFeatureName: SettingKey,
        private forcedValue = false,
    ) {
        super();
    }

    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        if (this.settingDisabled) {
            // per the docs: we force a disabled state when the feature isn't active
            return this.forcedValue;
        }
        return null; // no override
    }

    public get settingDisabled(): boolean {
        return !SettingsStore.getValue(this.uiFeatureName);
    }
}
