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

import dis from './dispatcher';
import SettingsStore from './settings/SettingsStore';

export class FontWatcher {
    constructor(minSize, maxSize) {
        this._min_size = minSize;
        this._max_size = maxSize;
        this._dispatcherRef = null;
    }

    start() {
        this._setRootFontSize(SettingsStore.getValue("font_size"));
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

    _setRootFontSize = size => {
        let fontSize = this._min_size < size ? size : this._min_size;
        fontSize = fontSize < this._max_size ? fontSize : this._max_size;
        if (fontSize != size) {
            SettingsStore.setValue("font_size", null, fontSize);
        }
        document.querySelector(":root").style.fontSize = fontSize + "px";
    }
}
