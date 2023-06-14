/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
 * Enforces that a boolean setting cannot be enabled if the incompatible setting
 * is also enabled, to prevent cascading undefined behaviour between conflicting
 * labs flags.
 */
export default class IncompatibleController extends SettingController {
    public constructor(
        private settingName: string,
        private forcedValue: any = false,
        private incompatibleValue: any | ((v: any) => boolean) = true,
    ) {
        super();
    }

    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        if (this.incompatibleSetting) {
            return this.forcedValue;
        }
        return null; // no override
    }

    public get settingDisabled(): boolean {
        return this.incompatibleSetting;
    }

    public get incompatibleSetting(): boolean {
        if (typeof this.incompatibleValue === "function") {
            return this.incompatibleValue(SettingsStore.getValue(this.settingName));
        }
        return SettingsStore.getValue(this.settingName) === this.incompatibleValue;
    }
}
