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
import SettingsStore from "../SettingsStore";
import dis from "../../dispatcher/dispatcher";
import { UpdateSystemFontPayload } from "../../dispatcher/payloads/UpdateSystemFontPayload";
import { Action } from "../../dispatcher/actions";
import { SettingLevel } from "../SettingLevel";

export default class SystemFontController extends SettingController {
    constructor() {
        super();
    }

    public onChange(level: SettingLevel, roomId: string, newValue: any) {
        // Dispatch font size change so that everything open responds to the change.
        dis.dispatch<UpdateSystemFontPayload>({
            action: Action.UpdateSystemFont,
            useSystemFont: SettingsStore.getValue("useSystemFont"),
            font: newValue,
        });
    }
}
