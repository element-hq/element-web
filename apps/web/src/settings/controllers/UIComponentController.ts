/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import { type SettingLevel } from "../SettingLevel";
import { type UIComponent } from "../UIFeature";

/**
 * Forces a boolean setting to `false` if a module has hidden the given UI component.
 * Otherwise, the setting value is unchanged.
 */
export default class UIComponentController extends SettingController {
    public constructor(private readonly component: UIComponent) {
        super();
    }

    public getValueOverride(
        level: SettingLevel,
        roomId: string | null,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        return this.settingDisabled ? false : null;
    }

    public get settingDisabled(): boolean {
        return SettingController.moduleCustomisations?.shouldShowComponent(this.component) === false;
    }
}
