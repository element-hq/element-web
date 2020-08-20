/*
Copyright 2017 Travis Ralston
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
    public constructor(private featureNames: string[]) {
        super();
    }

    public getValue(settingName: string, roomId: string): any {
        const config = SdkConfig.get() || {};

        if (this.featureNames.includes(settingName)) {
            const labsConfig = config["features"] || {};
            const val = labsConfig[settingName];
            if (isNullOrUndefined(val)) return null; // no definition at this level
            if (val === true || val === false) return val; // new style: mapped as a boolean
            if (val === "enable") return true; // backwards compat
            if (val === "disable") return false; // backwards compat
            if (val === "labs") return null; // backwards compat, no override
            return null; // fallback in the case of invalid input
        }

        // Special case themes
        if (settingName === "theme") {
            return config["default_theme"];
        }

        const settingsConfig = config["settingDefaults"];
        if (!settingsConfig || isNullOrUndefined(settingsConfig[settingName])) return null;
        return settingsConfig[settingName];
    }

    public async setValue(settingName: string, roomId: string, newValue: any): Promise<void> {
        throw new Error("Cannot change settings at the config level");
    }

    public canSetValue(settingName: string, roomId: string): boolean {
        return false;
    }

    public isSupported(): boolean {
        return true; // SdkConfig is always there
    }
}
