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

import { MatrixClientPeg } from '../../MatrixClientPeg';
import { SettingLevel } from "../SettingLevel";
import SettingController from "./SettingController";

/**
 * When the value changes, call a setter function on the matrix client with the new value
 */
export default class PushToMatrixClientController extends SettingController {
    constructor(private setter: Function, private inverse: boolean) {
        super();
    }

    public onChange(level: SettingLevel, roomId: string, newValue: any) {
        // XXX does this work? This surely isn't necessarily the effective value,
        // but it's what NotificationsEnabledController does...
        this.setter.call(MatrixClientPeg.get(), this.inverse ? !newValue : newValue);
    }
}
