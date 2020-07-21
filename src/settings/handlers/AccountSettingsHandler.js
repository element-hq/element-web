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

import {MatrixClientPeg} from '../../MatrixClientPeg';
import MatrixClientBackedSettingsHandler from "./MatrixClientBackedSettingsHandler";
import {SettingLevel} from "../SettingsStore";
import {objectClone, objectKeyChanges} from "../../utils/objects";

const BREADCRUMBS_LEGACY_EVENT_TYPE = "im.vector.riot.breadcrumb_rooms";
const BREADCRUMBS_EVENT_TYPE = "im.vector.setting.breadcrumbs";
const BREADCRUMBS_EVENT_TYPES = [BREADCRUMBS_LEGACY_EVENT_TYPE, BREADCRUMBS_EVENT_TYPE];
const RECENT_EMOJI_EVENT_TYPE = "io.element.recent_emoji";

const INTEG_PROVISIONING_EVENT_TYPE = "im.vector.setting.integration_provisioning";

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

    _onAccountData(event, prevEvent) {
        if (event.getType() === "org.matrix.preview_urls") {
            let val = event.getContent()['disable'];
            if (typeof(val) !== "boolean") {
                val = null;
            } else {
                val = !val;
            }

            this._watchers.notifyUpdate("urlPreviewsEnabled", null, SettingLevel.ACCOUNT, val);
        } else if (event.getType() === "im.vector.web.settings") {
            // Figure out what changed and fire those updates
            const prevContent = prevEvent ? prevEvent.getContent() : {};
            const changedSettings = objectKeyChanges(prevContent, event.getContent());
            for (const settingName of changedSettings) {
                const val = event.getContent()[settingName];
                this._watchers.notifyUpdate(settingName, null, SettingLevel.ACCOUNT, val);
            }
        } else if (BREADCRUMBS_EVENT_TYPES.includes(event.getType())) {
            this._notifyBreadcrumbsUpdate(event);
        } else if (event.getType() === INTEG_PROVISIONING_EVENT_TYPE) {
            const val = event.getContent()['enabled'];
            this._watchers.notifyUpdate("integrationProvisioning", null, SettingLevel.ACCOUNT, val);
        } else if (event.getType() === RECENT_EMOJI_EVENT_TYPE) {
            const val = event.getContent()['enabled'];
            this._watchers.notifyUpdate("recent_emoji", null, SettingLevel.ACCOUNT, val);
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

        // Special case for breadcrumbs
        if (settingName === "breadcrumb_rooms") {
            let content = this._getSettings(BREADCRUMBS_EVENT_TYPE);
            if (!content || !content['recent_rooms']) {
                content = this._getSettings(BREADCRUMBS_LEGACY_EVENT_TYPE);

                // This is a bit of a hack, but it makes things slightly easier
                if (content) content['recent_rooms'] = content['rooms'];
            }

            return content && content['recent_rooms'] ? content['recent_rooms'] : [];
        }

        // Special case recent emoji
        if (settingName === "recent_emoji") {
            const content = this._getSettings(RECENT_EMOJI_EVENT_TYPE);
            return content ? content["recent_emoji"] : null;
        }

        // Special case integration manager provisioning
        if (settingName === "integrationProvisioning") {
            const content = this._getSettings(INTEG_PROVISIONING_EVENT_TYPE);
            return content ? content['enabled'] : null;
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

        // Special case for breadcrumbs
        if (settingName === "breadcrumb_rooms") {
            // We read the value first just to make sure we preserve whatever random keys might be present.
            let content = this._getSettings(BREADCRUMBS_EVENT_TYPE);
            if (!content || !content['recent_rooms']) {
                content = this._getSettings(BREADCRUMBS_LEGACY_EVENT_TYPE);
            }
            if (!content) content = {}; // If we still don't have content, make some

            content['recent_rooms'] = newValue;
            return MatrixClientPeg.get().setAccountData(BREADCRUMBS_EVENT_TYPE, content);
        }

        // Special case recent emoji
        if (settingName === "recent_emoji") {
            const content = this._getSettings(RECENT_EMOJI_EVENT_TYPE) || {};
            content["recent_emoji"] = newValue;
            return MatrixClientPeg.get().setAccountData(RECENT_EMOJI_EVENT_TYPE, content);
        }

        // Special case integration manager provisioning
        if (settingName === "integrationProvisioning") {
            const content = this._getSettings(INTEG_PROVISIONING_EVENT_TYPE) || {};
            content['enabled'] = newValue;
            return MatrixClientPeg.get().setAccountData(INTEG_PROVISIONING_EVENT_TYPE, content);
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
        return objectClone(event.getContent()); // clone to prevent mutation
    }

    _notifyBreadcrumbsUpdate(event) {
        let val = [];
        if (event.getType() === BREADCRUMBS_LEGACY_EVENT_TYPE) {
            // This seems fishy - try and get the event for the new rooms
            const newType = this._getSettings(BREADCRUMBS_EVENT_TYPE);
            if (newType) val = newType['recent_rooms'];
            else val = event.getContent()['rooms'];
        } else if (event.getType() === BREADCRUMBS_EVENT_TYPE) {
            val = event.getContent()['recent_rooms'];
        } else {
            return; // for sanity, not because we expect to be here.
        }
        this._watchers.notifyUpdate("breadcrumb_rooms", null, SettingLevel.ACCOUNT, val || []);
    }
}
