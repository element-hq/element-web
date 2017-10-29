/*
Copyright 2017 Travis Ralston

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

import Promise from 'bluebird';
import SettingsHandler from "./SettingsHandler";
import SdkConfig from "../SdkConfig";

/**
 * Gets and sets settings at the "config" level. This handler does not make use of the
 * roomId parameter.
 */
export default class ConfigSettingsHandler extends SettingsHandler {
    getValue(settingName, roomId) {
        const settingsConfig = SdkConfig.get()["settingDefaults"];
        if (!settingsConfig || !settingsConfig[settingName]) return Promise.reject();
        return Promise.resolve(settingsConfig[settingName]);
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