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

import { _t } from "../../languageHandler";
import SettingController from "./SettingController";

export default class RustCryptoSdkController extends SettingController {
    public get settingDisabled(): boolean | string {
        // Currently this can only be changed via config.json. In future, we'll allow the user to *enable* this setting
        // via labs, which will migrate their existing device to the rust-sdk implementation.
        return _t("Can currently only be enabled via config.json");
    }
}
