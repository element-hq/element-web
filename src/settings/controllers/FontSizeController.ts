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
import dis from "../../dispatcher/dispatcher";
import { UpdateFontSizeDeltaPayload } from "../../dispatcher/payloads/UpdateFontSizeDeltaPayload";
import { Action } from "../../dispatcher/actions";
import { SettingLevel } from "../SettingLevel";

export default class FontSizeController extends SettingController {
    public constructor() {
        super();
    }

    public onChange(level: SettingLevel, roomId: string, newValue: any): void {
        // In a distant past, `baseFontSize` was set on the account and config
        // level. This can be accessed only after the initial sync. If we end up
        // discovering that a logged in user has this kind of setting, we want to
        // trigger another migration of the base font size.
        if (level === SettingLevel.ACCOUNT || level === SettingLevel.CONFIG) {
            dis.fire(Action.MigrateBaseFontSize);
        } else if (newValue !== "") {
            // Dispatch font size change so that everything open responds to the change.
            dis.dispatch<UpdateFontSizeDeltaPayload>({
                action: Action.UpdateFontSizeDelta,
                delta: newValue,
            });
        }
    }
}
