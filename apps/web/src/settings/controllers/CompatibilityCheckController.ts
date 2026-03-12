/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import { type SettingLevel } from "../SettingLevel";

/**
 * Enforces that a boolean setting cannot be changed if a function returns false.
 */
export default class CompatibilityCheckController extends SettingController {
    /**
     * @param compatibleCheck A function that checks if the setting is incompatible. May return a reason string.
     * @param forcedValue The forced value if the setting is incompatible.
     */
    public constructor(
        private compatibleCheck: () => boolean | string,
        private forcedValue = false,
    ) {
        super();
    }

    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        if (!this.compatibleSetting) {
            return this.forcedValue;
        }
        return null; // no override
    }

    public get settingDisabled(): boolean | string {
        return this.compatibleSetting;
    }

    public get compatibleSetting(): boolean | string {
        return this.compatibleCheck();
    }
}
