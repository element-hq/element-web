/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import SettingController from "./SettingController";
import { SettingLevel } from "../SettingLevel";

/**
 * Allows for multiple controllers to affect a setting. The first controller
 * provided to this class which overrides the setting value will affect
 * the value - other controllers are not called. Change notification handlers
 * are proxied through to all controllers.
 *
 * Similarly, the first controller which indicates that a setting is disabled
 * will be used - other controllers will not be considered.
 */
export class OrderedMultiController extends SettingController {
    public constructor(public readonly controllers: SettingController[]) {
        super();
    }

    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        for (const controller of this.controllers) {
            const override = controller.getValueOverride(level, roomId, calculatedValue, calculatedAtLevel);
            if (override !== undefined && override !== null) return override;
        }
        return null; // no override
    }

    public onChange(level: SettingLevel, roomId: string, newValue: any): void {
        for (const controller of this.controllers) {
            controller.onChange(level, roomId, newValue);
        }
    }

    public get settingDisabled(): boolean {
        for (const controller of this.controllers) {
            if (controller.settingDisabled) return true;
        }
        return false;
    }
}
