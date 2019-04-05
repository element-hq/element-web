/*
Copyright 2017 Travis Ralston
Copyright 2019 New Vector Ltd.

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

import SettingsHandler from "./SettingsHandler";

/**
 * Gets settings at the "default" level. This handler does not support setting values.
 * This handler does not make use of the roomId parameter.
 */
export default class DefaultSettingsHandler extends SettingsHandler {
    /**
     * Creates a new default settings handler with the given defaults
     * @param {object} defaults The default setting values, keyed by setting name.
     * @param {object} invertedDefaults The default inverted setting values, keyed by setting name.
     */
    constructor(defaults, invertedDefaults) {
        super();
        this._defaults = defaults;
        this._invertedDefaults = invertedDefaults;
    }

    getValue(settingName, roomId) {
        let value = this._defaults[settingName];
        if (value === undefined) {
            value = this._invertedDefaults[settingName];
        }
        return value;
    }

    setValue(settingName, roomId, newValue) {
        throw new Error("Cannot set values on the default level handler");
    }

    canSetValue(settingName, roomId) {
        return false;
    }

    isSupported() {
        return true;
    }
}
