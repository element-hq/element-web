/*
Copyright 2017 Travis Ralston
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

import { SettingLevel } from "../SettingLevel";

/**
 * Represents a controller for individual settings to alter the reading behaviour
 * based upon environmental conditions, or to react to changes and therefore update
 * the working environment.
 *
 * This is not intended to replace the functionality of a SettingsHandler, it is only
 * intended to handle environmental factors for specific settings.
 */
export default abstract class SettingController {
    /**
     * Gets the overridden value for the setting, if any. This must return null if the
     * value is not to be overridden, otherwise it must return the new value.
     * @param {string} level The level at which the value was requested at.
     * @param {String} roomId The room ID, may be null.
     * @param {*} calculatedValue The value that the handlers think the setting should be,
     * may be null.
     * @param {SettingLevel} calculatedAtLevel The level for which the calculated value was
     * calculated at. May be null.
     * @return {*} The value that should be used, or null if no override is applicable.
     */
    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel,
    ): any {
        return null; // no override
    }

    /**
     * Called when the setting value has been changed.
     * @param {string} level The level at which the setting has been modified.
     * @param {String} roomId The room ID, may be null.
     * @param {*} newValue The new value for the setting, may be null.
     */
    public onChange(level: SettingLevel, roomId: string, newValue: any) {
        // do nothing by default
    }
}
