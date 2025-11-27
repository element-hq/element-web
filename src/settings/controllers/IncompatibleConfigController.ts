/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController.ts";
import { type SettingLevel } from "../SettingLevel.ts";
import { IConfigOptions } from "../../IConfigOptions.ts";
import SdkConfig from "../../SdkConfig.ts";

/**
 * Enforces that a boolean setting cannot be enabled if the incompatible setting
 * is also enabled, to prevent cascading undefined behaviour between conflicting
 * labs flags.
 */
export default class IncompatibleConfigController extends SettingController {
    public constructor(
        private readonly getSetting: (c: IConfigOptions) => boolean,
        private forcedValue: any = false,
        private incompatibleValue: any | ((v: any) => boolean) = true,
        private readonly disabledString?: string,
    ) {
        super();
        console.log(SdkConfig.get());
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

    public get configSettingValue(): boolean {
        return this.getSetting(SdkConfig.get());
    }

    public get settingDisabled(): boolean|string {
        console.log("IncompatibleConfigController", this.configSettingValue, this.incompatibleSetting ? (this.disabledString ?? true) : false);
        return this.incompatibleSetting ? (this.disabledString ?? true) : false;
    }

    public get incompatibleSetting(): boolean {
        if (typeof this.incompatibleValue === "function") {
            return this.incompatibleValue(this.configSettingValue);
        }
        return this.configSettingValue === this.incompatibleValue;
    }
}
