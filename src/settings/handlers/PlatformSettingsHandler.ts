/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import PlatformPeg from "../../PlatformPeg";

/**
 * Gets and sets settings at the "platform" level for the current device.
 * This handler does not make use of the roomId parameter.
 */
export default class PlatformSettingsHandler extends SettingsHandler {
    public canSetValue(settingName: string, roomId: string): boolean {
        return PlatformPeg.get().supportsSetting(settingName);
    }

    public getValue(settingName: string, roomId: string): any {
        return PlatformPeg.get().getSettingValue(settingName);
    }

    public setValue(settingName: string, roomId: string, newValue: any): Promise<void> {
        return PlatformPeg.get().setSettingValue(settingName, newValue);
    }

    public isSupported(): boolean {
        return PlatformPeg.get().supportsSetting();
    }
}
