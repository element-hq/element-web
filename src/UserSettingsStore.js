/*
Copyright 2015, 2016 OpenMarket Ltd

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

'use strict';
var q = require("q");
var MatrixClientPeg = require("./MatrixClientPeg");
var Notifier = require("./Notifier");

/*
 * TODO: Make things use this. This is all WIP - see UserSettings.js for usage.
 */

module.exports = {
    LABS_FEATURES: [
        {
            name: 'New Composer & Autocomplete',
            id: 'rich_text_editor',
            default: false,
        },
    ],

    loadProfileInfo: function() {
        var cli = MatrixClientPeg.get();
        return cli.getProfileInfo(cli.credentials.userId);
    },

    saveDisplayName: function(newDisplayname) {
        return MatrixClientPeg.get().setDisplayName(newDisplayname);
    },

    loadThreePids: function() {
        if (MatrixClientPeg.get().isGuest()) {
            return q({
                threepids: []
            }); // guests can't poke 3pid endpoint
        }
        return MatrixClientPeg.get().getThreePids();
    },

    saveThreePids: function(threePids) {
        // TODO
    },

    getEnableNotifications: function() {
        return Notifier.isEnabled();
    },

    setEnableNotifications: function(enable) {
        if (!Notifier.supportsDesktopNotifications()) {
            return;
        }
        Notifier.setEnabled(enable);
    },

    getEnableAudioNotifications: function() {
        return Notifier.isAudioEnabled();
    },

    setEnableAudioNotifications: function(enable) {
        Notifier.setAudioEnabled(enable);
    },

    changePassword: function(old_password, new_password) {
        var cli = MatrixClientPeg.get();

        var authDict = {
            type: 'm.login.password',
            user: cli.credentials.userId,
            password: old_password
        };

        return cli.setPassword(authDict, new_password);
    },

    /**
     * Returns the email pusher (pusher of type 'email') for a given
     * email address. Email pushers all have the same app ID, so since
     * pushers are unique over (app ID, pushkey), there will be at most
     * one such pusher.
     */
    getEmailPusher: function(pushers, address) {
        if (pushers === undefined) {
            return undefined;
        }
        for (var i = 0; i < pushers.length; ++i) {
            if (pushers[i].kind == 'email' && pushers[i].pushkey == address) {
                return pushers[i];
            }
        }
        return undefined;
    },

    hasEmailPusher: function(pushers, address) {
        return this.getEmailPusher(pushers, address) !== undefined;
    },

    addEmailPusher: function(address, data) {
        return MatrixClientPeg.get().setPusher({
            kind: 'email',
            app_id: "m.email",
            pushkey: address,
            app_display_name: 'Email Notifications',
            device_display_name: address,
            lang: navigator.language,
            data: data,
            append: true,  // We always append for email pushers since we don't want to stop other accounts notifying to the same email address
        });
    },

    getUrlPreviewsDisabled: function() {
        var event = MatrixClientPeg.get().getAccountData("org.matrix.preview_urls");
        return (event && event.getContent().disable);
    },

    setUrlPreviewsDisabled: function(disabled) {
        // FIXME: handle errors
        return MatrixClientPeg.get().setAccountData("org.matrix.preview_urls", {
            disable: disabled
        });
    },

    getSyncedSettings: function() {
        var event = MatrixClientPeg.get().getAccountData("im.vector.web.settings");
        return event ? event.getContent() : {};
    },

    getSyncedSetting: function(type, defaultValue = null) {
        var settings = this.getSyncedSettings();
        return settings.hasOwnProperty(type) ? settings[type] : defaultValue;
    },

    setSyncedSetting: function(type, value) {
        var settings = this.getSyncedSettings();
        settings[type] = value;
        // FIXME: handle errors
        return MatrixClientPeg.get().setAccountData("im.vector.web.settings", settings);
    },

    getLocalSettings: function() {
        var localSettingsString = localStorage.getItem('mx_local_settings') || '{}';
        return JSON.parse(localSettingsString);
    },

    getLocalSetting: function(type, defaultValue = null) {
        var settings = this.getLocalSettings();
        return settings.hasOwnProperty(type) ? settings[type] : defaultValue;
    },

    setLocalSetting: function(type, value) {
        var settings = this.getLocalSettings();
        settings[type] = value;
        // FIXME: handle errors
        localStorage.setItem('mx_local_settings', JSON.stringify(settings));
    },

    isFeatureEnabled: function(feature: string): boolean {
        // Disable labs for guests.
        if (MatrixClientPeg.get().isGuest()) return false;

        if (localStorage.getItem(`mx_labs_feature_${feature}`) === null) {
            for (var i = 0; i < this.LABS_FEATURES.length; i++) {
                var f = this.LABS_FEATURES[i];
                if (f.id === feature) {
                    return f.default;
                }
            }
        }
        return localStorage.getItem(`mx_labs_feature_${feature}`) === 'true';
    },

    setFeatureEnabled: function(feature: string, enabled: boolean) {
        localStorage.setItem(`mx_labs_feature_${feature}`, enabled);
    }
};
