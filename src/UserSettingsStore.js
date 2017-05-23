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
import q from 'q';
import MatrixClientPeg from './MatrixClientPeg';
import Notifier from './Notifier';

/*
 * TODO: Make things use this. This is all WIP - see UserSettings.js for usage.
 */

/*
 * TODO: Find a way to translate the names of LABS_FEATURES. In other words, guarantee that languages were already loaded before building this array.
 */

module.exports = {
    LABS_FEATURES: [
        {
            name: "New Composer & Autocomplete",
            id: 'rich_text_editor',
            default: false,
        },
    ],

    loadProfileInfo: function() {
        const cli = MatrixClientPeg.get();
        return cli.getProfileInfo(cli.credentials.userId);
    },

    saveDisplayName: function(newDisplayname) {
        return MatrixClientPeg.get().setDisplayName(newDisplayname);
    },

    loadThreePids: function() {
        if (MatrixClientPeg.get().isGuest()) {
            return q({
                threepids: [],
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

    changePassword: function(oldPassword, newPassword) {
        const cli = MatrixClientPeg.get();

        const authDict = {
            type: 'm.login.password',
            user: cli.credentials.userId,
            password: oldPassword,
        };

        return cli.setPassword(authDict, newPassword);
    },

    /*
     * Returns the email pusher (pusher of type 'email') for a given
     * email address. Email pushers all have the same app ID, so since
     * pushers are unique over (app ID, pushkey), there will be at most
     * one such pusher.
     */
    getEmailPusher: function(pushers, address) {
        if (pushers === undefined) {
            return undefined;
        }
        for (let i = 0; i < pushers.length; ++i) {
            if (pushers[i].kind === 'email' && pushers[i].pushkey === address) {
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
            app_id: 'm.email',
            pushkey: address,
            app_display_name: 'Email Notifications',
            device_display_name: address,
            lang: navigator.language,
            data: data,
            append: true,  // We always append for email pushers since we don't want to stop other accounts notifying to the same email address
        });
    },

    getUrlPreviewsDisabled: function() {
        const event = MatrixClientPeg.get().getAccountData('org.matrix.preview_urls');
        return (event && event.getContent().disable);
    },

    setUrlPreviewsDisabled: function(disabled) {
        // FIXME: handle errors
        return MatrixClientPeg.get().setAccountData('org.matrix.preview_urls', {
            disable: disabled,
        });
    },

    getSyncedSettings: function() {
        const event = MatrixClientPeg.get().getAccountData('im.vector.web.settings');
        return event ? event.getContent() : {};
    },

    getSyncedSetting: function(type, defaultValue = null) {
        const settings = this.getSyncedSettings();
        return settings.hasOwnProperty(type) ? settings[type] : defaultValue;
    },

    setSyncedSetting: function(type, value) {
        const settings = this.getSyncedSettings();
        settings[type] = value;
        // FIXME: handle errors
        return MatrixClientPeg.get().setAccountData('im.vector.web.settings', settings);
    },

    getLocalSettings: function() {
        const localSettingsString = localStorage.getItem('mx_local_settings') || '{}';
        return JSON.parse(localSettingsString);
    },

    getLocalSetting: function(type, defaultValue = null) {
        const settings = this.getLocalSettings();
        return settings.hasOwnProperty(type) ? settings[type] : defaultValue;
    },

    setLocalSetting: function(type, value) {
        const settings = this.getLocalSettings();
        settings[type] = value;
        // FIXME: handle errors
        localStorage.setItem('mx_local_settings', JSON.stringify(settings));
    },

    isFeatureEnabled: function(feature: string): boolean {
        // Disable labs for guests.
        if (MatrixClientPeg.get().isGuest()) return false;

        if (localStorage.getItem(`mx_labs_feature_${feature}`) === null) {
            for (let i = 0; i < this.LABS_FEATURES.length; i++) {
                const f = this.LABS_FEATURES[i];
                if (f.id === feature) {
                    return f.default;
                }
            }
        }
        return localStorage.getItem(`mx_labs_feature_${feature}`) === 'true';
    },

    setFeatureEnabled: function(feature: string, enabled: boolean) {
        localStorage.setItem(`mx_labs_feature_${feature}`, enabled);
    },
};
