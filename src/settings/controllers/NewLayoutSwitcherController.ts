/*
Copyright 2021 The Matrix.org Foundation C.I.C.
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
import SettingsStore from "../SettingsStore";
import { Layout } from "../enums/Layout";

export default class NewLayoutSwitcherController extends SettingController {
    public onChange(level: SettingLevel, roomId: string, newValue: any) {
        // On disabling switch back to Layout.Group if Layout.Bubble
        if (!newValue && SettingsStore.getValue("layout") == Layout.Bubble) {
            SettingsStore.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
        }
    }
}
