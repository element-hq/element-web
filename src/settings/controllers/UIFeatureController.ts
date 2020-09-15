/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import SettingController from "./SettingController";
import { SettingLevel } from "../SettingLevel";
import SettingsStore from "../SettingsStore";

/**
 * Enforces that a boolean setting cannot be enabled if the corresponding
 * UI feature is disabled. If the UI feature is enabled, the setting value
 * is unchanged.
 *
 * Settings using this controller are assumed to return `false` when disabled.
 */
export default class UIFeatureController extends SettingController {
    public constructor(private uiFeatureName: string) {
        super();
    }

    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel,
    ): any {
        if (!SettingsStore.getValue(this.uiFeatureName)) {
            // per the docs: we force a disabled state when the feature isn't active
            return false;
        }
        return null; // no override
    }
}
