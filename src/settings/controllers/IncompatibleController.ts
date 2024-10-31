/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
