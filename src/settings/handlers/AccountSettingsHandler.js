/*
Copyright 2017 Travis Ralston

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

import SettingsHandler from "./SettingsHandler";
import MatrixClientPeg from '../../MatrixClientPeg';

/**
 * Gets and sets settings at the "account" level for the current user.
 * This handler does not make use of the roomId parameter.
 */
export default class AccountSettingHandler extends SettingsHandler {
    getValue(settingName, roomId) {
        // Special case URL previews
        if (settingName === "urlPreviewsEnabled") {
            const content = this._getSettings("org.matrix.preview_urls");
            return !content['disable'];
        }

        return this._getSettings()[settingName];
    }

    setValue(settingName, roomId, newValue) {
        // Special case URL previews
        if (settingName === "urlPreviewsEnabled") {
            const content = this._getSettings("org.matrix.preview_urls");
            content['disable'] = !newValue;
            return MatrixClientPeg.get().setAccountData("org.matrix.preview_urls", content);
        }

        const content = this._getSettings();
        content[settingName] = newValue;
        return MatrixClientPeg.get().setAccountData("im.vector.web.settings", content);
    }

    canSetValue(settingName, roomId) {
        return true; // It's their account, so they should be able to
    }

    isSupported() {
        const cli = MatrixClientPeg.get();
        return cli !== undefined && cli !== null;
    }

    _getSettings(eventType = "im.vector.web.settings") {
        const event = MatrixClientPeg.get().getAccountData(eventType);
        if (!event || !event.getContent()) return {};
        return event.getContent();
    }
}
