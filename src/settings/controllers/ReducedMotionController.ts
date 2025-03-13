/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import { type SettingLevel } from "../SettingLevel";

/**
 * For animation-like settings, this controller checks whether the user has
 * indicated they prefer reduced motion via browser or OS level settings.
 * If they have, this forces the setting value to false.
 */
export default class ReducedMotionController extends SettingController {
    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        if (this.prefersReducedMotion()) {
            return false;
        }
        return null; // no override
    }

    public get settingDisabled(): boolean {
        return this.prefersReducedMotion();
    }

    private prefersReducedMotion(): boolean {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
}
