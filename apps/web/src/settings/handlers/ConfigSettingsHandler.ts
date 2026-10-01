/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { isNullOrUndefined } from "matrix-js-sdk/src/utils";

import SettingsHandler from "./SettingsHandler";
import SdkConfig from "../../SdkConfig";
import { SnakedObject } from "../../utils/SnakedObject";
import { type IConfigOptions } from "../../IConfigOptions";

/**
 * Gets and sets settings at the "config" level. This handler does not make use of the
 * roomId parameter.
 */
export default class ConfigSettingsHandler extends SettingsHandler {
    public constructor(private featureNames: string[]) {
        super();
    }

    public getValue(settingName: string, roomId: string): any {
        const config = new SnakedObject<IConfigOptions>(SdkConfig.get());

        if (this.featureNames.includes(settingName)) {
            const labsConfig = config.get("features") || {};
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
            return config.get("default_theme");
        }

        const settingsConfig = config.get("setting_defaults");
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
