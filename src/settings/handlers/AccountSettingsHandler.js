/*
Copyright 2017 Travis Ralston
Copyright 2019 New Vector Ltd.

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

import MatrixClientPeg from '../../MatrixClientPeg';
import MatrixClientBackedSettingsHandler from "./MatrixClientBackedSettingsHandler";
import {SettingLevel} from "../SettingsStore";

/**
 * Gets and sets settings at the "account" level for the current user.
 * This handler does not make use of the roomId parameter.
 */
export default class AccountSettingsHandler extends MatrixClientBackedSettingsHandler {
    constructor(watchManager) {
        super();

        this._watchers = watchManager;
        this._onAccountData = this._onAccountData.bind(this);
    }

    initMatrixClient(oldClient, newClient) {
        if (oldClient) {
            oldClient.removeListener("accountData", this._onAccountData);
        }

        newClient.on("accountData", this._onAccountData);
    }

    _onAccountData(event) {
        if (event.getType() === "org.matrix.preview_urls") {
            let val = event.getContent()['disable'];
            if (typeof(val) !== "boolean") {
                val = null;
            } else {
                val = !val;
            }

            this._watchers.notifyUpdate("urlPreviewsEnabled", null, SettingLevel.ACCOUNT, val);
        } else if (event.getType() === "im.vector.web.settings") {
            // We can't really discern what changed, so trigger updates for everything
            for (const settingName of Object.keys(event.getContent())) {
                const val = event.getContent()[settingName];
                this._watchers.notifyUpdate(settingName, null, SettingLevel.ACCOUNT, val);
            }
        }
    }

    getValue(settingName, roomId) {
        // Special case URL previews
        if (settingName === "urlPreviewsEnabled") {
            const content = this._getSettings("org.matrix.preview_urls") || {};

            // Check to make sure that we actually got a boolean
            if (typeof(content['disable']) !== "boolean") return null;
            return !content['disable'];
        }

        const settings = this._getSettings() || {};
        let preferredValue = settings[settingName];

        if (preferredValue === null || preferredValue === undefined) {
            // Honour the old setting on read only
            if (settingName === "hideAvatarChanges" || settingName === "hideDisplaynameChanges") {
                preferredValue = settings["hideAvatarDisplaynameChanges"];
            }
        }

        return preferredValue;
    }

    setValue(settingName, roomId, newValue) {
        // Special case URL previews
        if (settingName === "urlPreviewsEnabled") {
            const content = this._getSettings("org.matrix.preview_urls") || {};
            content['disable'] = !newValue;
            return MatrixClientPeg.get().setAccountData("org.matrix.preview_urls", content);
        }

        const content = this._getSettings() || {};
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
        const cli = MatrixClientPeg.get();
        if (!cli) return null;

        const event = cli.getAccountData(eventType);
        if (!event || !event.getContent()) return null;
        return event.getContent();
    }
}
