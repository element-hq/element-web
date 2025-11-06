/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController.ts";
import { type SettingLevel } from "../SettingLevel.ts";
import IncompatibleController from "./IncompatibleController.ts";
import IncompatibleConfigController from "./IncompatibleConfigController.ts";

/**
 * Enforces that a boolean setting cannot be enabled if the incompatible setting
 * is also enabled, to prevent cascading undefined behaviour between conflicting
 * labs flags.
 */
export default class CombinationIncompatbleController extends SettingController {
    public constructor(
        private readonly controllers: (IncompatibleConfigController|IncompatibleController)[]
    ) {
        super();
    }

    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        for (const controller of this.controllers) {
            const res = controller.getValueOverride(level, roomId, calculatedValue, calculatedAtLevel);
            if (res !== null) {
                return res;
            }
        }
        return null;
    }

    public get settingDisabled(): boolean|string {
        for (const controller of this.controllers) {
            const res = controller.settingDisabled;
            if (res) {
                return res;
            }
        }
        return false;
    }

    public get incompatibleSetting(): boolean {
        return this.controllers.some(s => s.incompatibleSetting);
    }
}
