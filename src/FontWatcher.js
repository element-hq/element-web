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

import dis from './dispatcher/dispatcher';
import SettingsStore, {SettingLevel} from './settings/SettingsStore';

export class FontWatcher {
    static MIN_SIZE = 13;
    static MAX_SIZE = 20;

    constructor() {
        this._dispatcherRef = null;
    }

    start() {
        this._setRootFontSize(SettingsStore.getValue("fontSize"));
        this._dispatcherRef = dis.register(this._onAction);
    }

    stop() {
        dis.unregister(this._dispatcherRef);
    }

    _onAction = (payload) => {
        if (payload.action === 'update-font-size') {
            this._setRootFontSize(payload.size);
        }
    };

    _setRootFontSize = (size) => {
        const fontSize = Math.max(Math.min(FontWatcher.MAX_SIZE, size), FontWatcher.MIN_SIZE);

        if (fontSize != size) {
            SettingsStore.setValue("fontSize", null, SettingLevel.Device, fontSize);
        }
        document.querySelector(":root").style.fontSize = fontSize + "px";
    };
}
