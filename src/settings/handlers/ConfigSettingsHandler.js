/*
Copyright 2017 Travis Ralston
Copyright 2019 New Vector Ltd

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
import SdkConfig from "../../SdkConfig";
import {isNullOrUndefined} from "matrix-js-sdk/src/utils";

/**
 * Gets and sets settings at the "config" level. This handler does not make use of the
 * roomId parameter.
 */
export default class ConfigSettingsHandler extends SettingsHandler {
    getValue(settingName, roomId) {
        const config = SdkConfig.get() || {};

        // Special case themes
        if (settingName === "theme") {
            return config["default_theme"];
        }

        const settingsConfig = config["settingDefaults"];
        if (!settingsConfig || isNullOrUndefined(settingsConfig[settingName])) return null;
        return settingsConfig[settingName];
    }

    setValue(settingName, roomId, newValue) {
        throw new Error("Cannot change settings at the config level");
    }

    canSetValue(settingName, roomId) {
        return false;
    }

    isSupported() {
        return true; // SdkConfig is always there
    }
}
