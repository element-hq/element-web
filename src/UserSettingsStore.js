/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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

import Promise from 'bluebird';
import MatrixClientPeg from './MatrixClientPeg';
import Notifier from './Notifier';
import { _t, _td } from './languageHandler';
import SdkConfig from './SdkConfig';

/*
 * TODO: Make things use this. This is all WIP - see UserSettings.js for usage.
 */

const FEATURES = [
    {
        id: 'feature_groups',
        name: _td("Groups"),
    },
];

export default {
    getLabsFeatures() {
        const featuresConfig = SdkConfig.get()['features'] || {};

        return FEATURES.filter((f) => {
            const sdkConfigValue = featuresConfig[f.id];
            if (!['enable', 'disable'].includes(sdkConfigValue)) {
                return true;
            }
        }).map((f) => {
            return f.id;
        });
    },

    translatedNameForFeature(featureId) {
        const feature = FEATURES.filter((f) => {
            return f.id === featureId;
        })[0];

        if (feature === undefined) return null;

        return _t(feature.name);
    },

    loadProfileInfo: function() {
        const cli = MatrixClientPeg.get();
        return cli.getProfileInfo(cli.credentials.userId);
    },

    saveDisplayName: function(newDisplayname) {
        return MatrixClientPeg.get().setDisplayName(newDisplayname);
    },

    loadThreePids: function() {
        if (MatrixClientPeg.get().isGuest()) {
            return Promise.resolve({
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

    isFeatureEnabled: function(featureId: string): boolean {
        const featuresConfig = SdkConfig.get()['features'];

        let sdkConfigValue = 'labs';
        if (featuresConfig && featuresConfig[featureId] !== undefined) {
            sdkConfigValue = featuresConfig[featureId];
        }

        if (sdkConfigValue === 'enable') {
            return true;
        } else if (sdkConfigValue === 'disable') {
            return false;
        } else if (sdkConfigValue === 'labs') {
            if (!MatrixClientPeg.get().isGuest()) {
                // Make it explicit that guests get the defaults (although they shouldn't
                // have been able to ever toggle the flags anyway)
                const userValue = localStorage.getItem(`mx_labs_feature_${featureId}`);
                if (userValue !== null) {
                    return userValue === 'true';
                }
            }
            return false;
        } else {
            console.warn(`Unknown features config for ${featureId}: ${sdkConfigValue}`);
            return false;
        }
    },

    setFeatureEnabled: function(featureId: string, enabled: boolean) {
        localStorage.setItem(`mx_labs_feature_${featureId}`, enabled);
    },
};
