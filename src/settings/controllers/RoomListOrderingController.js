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

export default class RoomListOrderingController extends SettingController {
    augmentValue(level, roomId, newValue): * {
        // currently we expose algorithm as a boolean but store it as a string for future flexibility
        // where we may want >2 algorithms available for the user to choose between.
        return newValue ? "recent" : "alphabetic";
    }
}
