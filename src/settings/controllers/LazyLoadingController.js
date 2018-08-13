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

import SettingController from "./SettingController";
import MatrixClientPeg from "../../MatrixClientPeg";
import PlatformPeg from "../../PlatformPeg";

export default class LazyLoadingController extends SettingController {
    async onChange(level, roomId, newValue) {
        if (!PlatformPeg.get()) return;

        MatrixClientPeg.get().stopClient();
        await MatrixClientPeg.get().store.deleteAllData();
        PlatformPeg.get().reload();
    }
}
