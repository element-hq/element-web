/*
Copyright 2018 New Vector

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

import SettingsStore from "../SettingsStore";
import SettingController from "./SettingController";
import Modal from "../../Modal";
import sdk from "../../index";
import MatrixClientPeg  from "../../MatrixClientPeg";
import dis from "../../dispatcher";
import { _t } from "../../languageHandler";

export default class LazyLoadingController extends SettingController {
    onChange(level, roomId, newValue) {
        dis.dispatch({action: 'flush_storage_reload'});
    }
}
