/*
Copyright 2019 New Vector Ltd

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

import React from 'react';
import {_t} from "../../../../languageHandler";
import {SettingLevel} from "../../../../settings/SettingsStore";
import LabelledToggleSwitch from "../../elements/LabelledToggleSwitch";
import SettingsStore from "../../../../settings/SettingsStore";
import Field from "../../elements/Field";
const sdk = require("../../../../index");
const PlatformPeg = require("../../../../PlatformPeg");

export default class PreferencesSettingsTab extends React.Component {
    static COMPOSER_SETTINGS = [
        'MessageComposerInput.autoReplaceEmoji',
        'MessageComposerInput.suggestEmoji',
        'sendTypingNotifications',
    ];

    static TIMELINE_SETTINGS = [
        'autoplayGifsAndVideos',
        'urlPreviewsEnabled',
        'TextualBody.enableBigEmoji',
        'showReadReceipts',
        'showTwelveHourTimestamps',
        'alwaysShowTimestamps',
        'showRedactions',
        'enableSyntaxHighlightLanguageDetection',
        'showJoinLeaves',
        'showAvatarChanges',
        'showDisplaynameChanges',
    ];

    static ADVANCED_SETTINGS = [
        'alwaysShowEncryptionIcons',
        'Pill.shouldShowPillAvatar',
        'TagPanel.enableTagPanel',
        'promptBeforeInviteUnknownUsers',
        // Start automatically after startup (electron-only)
        // Autocomplete delay (niche text box)
    ];

    constructor() {
        super();

        this.state = {
            autoLaunch: false,
            autoLaunchSupported: false,
        };
    }

    async componentWillMount(): void {
        const autoLaunchSupported = await PlatformPeg.get().supportsAutoLaunch();
        let autoLaunch = false;

        if (autoLaunchSupported) {
            autoLaunch = await PlatformPeg.get().getAutoLaunchEnabled();
        }

        this.setState({autoLaunch, autoLaunchSupported});
    }

    _onAutoLaunchChange = (checked) => {
        PlatformPeg.get().setAutoLaunchEnabled(checked).then(() => this.setState({autoLaunch: checked}));
    };

    _onAutocompleteDelayChange = (e) => {
        SettingsStore.setValue("autocompleteDelay", null, SettingLevel.DEVICE, e.target.value);
    };

    _renderGroup(settingIds) {
        const SettingsFlag = sdk.getComponent("views.elements.SettingsFlag");
        return settingIds.map(i => <SettingsFlag key={i} name={i} level={SettingLevel.ACCOUNT} />);
    }

    render() {
        let autoLaunchOption = null;
        if (this.state.autoLaunchSupported) {
            autoLaunchOption = <LabelledToggleSwitch value={this.state.autoLaunch}
                                                     onChange={this._onAutoLaunchChange}
                                                     label={_t('Start automatically after system login')} />;
        }

        return (
            <div className="mx_SettingsTab mx_PreferencesSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Preferences")}</div>
                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Composer")}</span>
                    {this._renderGroup(PreferencesSettingsTab.COMPOSER_SETTINGS)}

                    <span className="mx_SettingsTab_subheading">{_t("Timeline")}</span>
                    {this._renderGroup(PreferencesSettingsTab.TIMELINE_SETTINGS)}

                    <span className="mx_SettingsTab_subheading">{_t("Advanced")}</span>
                    {this._renderGroup(PreferencesSettingsTab.ADVANCED_SETTINGS)}
                    {autoLaunchOption}
                    <Field id={"autocompleteDelay"} label={_t('Autocomplete delay (ms)')} type='number'
                           value={SettingsStore.getValueAt(SettingLevel.DEVICE, 'autocompleteDelay')}
                           onChange={this._onAutocompleteDelayChange} />
                </div>
            </div>
        );
    }
}
