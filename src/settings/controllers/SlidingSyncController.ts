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

import SettingController from "./SettingController";
import PlatformPeg from "../../PlatformPeg";
import { SettingLevel } from "../SettingLevel";
import { SlidingSyncOptionsDialog } from "../../components/views/dialogs/SlidingSyncOptionsDialog";
import Modal from "../../Modal";
import SettingsStore from "../SettingsStore";
import { _t } from "../../languageHandler";

export default class SlidingSyncController extends SettingController {
    public async beforeChange(level: SettingLevel, roomId: string, newValue: any): Promise<boolean> {
        const { finished } = Modal.createDialog(SlidingSyncOptionsDialog);
        const [value] = await finished;
        return newValue === value; // abort the operation if we're already in the state the user chose via modal
    }

    public async onChange(): Promise<void> {
        PlatformPeg.get()?.reload();
    }

    public get settingDisabled(): boolean | string {
        // Cannot be disabled once enabled, user has been warned and must log out and back in.
        if (SettingsStore.getValue("feature_sliding_sync")) {
            return _t("Log out and back in to disable");
        }

        return false;
    }
}
