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
import {_t} from "../../../../../languageHandler";
import {SettingLevel} from "../../../../../settings/SettingsStore";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import SettingsStore from "../../../../../settings/SettingsStore";
import Field from "../../../elements/Field";
const sdk = require("../../../../..");
const PlatformPeg = require("../../../../../PlatformPeg");

export default class PreferencesUserSettingsTab extends React.Component {
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

    static ROOM_LIST_SETTINGS = [
        'RoomList.orderByImportance',
        'breadcrumbs',
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
            minimizeToTray: true,
            minimizeToTraySupported: false,
        };
    }

    async componentWillMount(): void {
        const platform = PlatformPeg.get();

        const autoLaunchSupported = await platform.supportsAutoLaunch();
        let autoLaunch = false;

        if (autoLaunchSupported) {
            autoLaunch = await platform.getAutoLaunchEnabled();
        }

        const minimizeToTraySupported = await platform.supportsMinimizeToTray();
        let minimizeToTray = true;

        if (minimizeToTraySupported) {
            minimizeToTray = await platform.getMinimizeToTrayEnabled();
        }

        this.setState({autoLaunch, autoLaunchSupported, minimizeToTraySupported, minimizeToTray});
    }

    _onAutoLaunchChange = (checked) => {
        PlatformPeg.get().setAutoLaunchEnabled(checked).then(() => this.setState({autoLaunch: checked}));
    };

    _onMinimizeToTrayChange = (checked) => {
        PlatformPeg.get().setMinimizeToTrayEnabled(checked).then(() => this.setState({minimizeToTray: checked}));
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

        let minimizeToTrayOption = null;
        if (this.state.minimizeToTraySupported) {
            minimizeToTrayOption = <LabelledToggleSwitch value={this.state.minimizeToTray}
                                                         onChange={this._onMinimizeToTrayChange}
                                                         label={_t('Close button should minimize window to tray')} />;
        }

        return (
            <div className="mx_SettingsTab mx_PreferencesUserSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Preferences")}</div>
                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Composer")}</span>
                    {this._renderGroup(PreferencesUserSettingsTab.COMPOSER_SETTINGS)}

                    <span className="mx_SettingsTab_subheading">{_t("Timeline")}</span>
                    {this._renderGroup(PreferencesUserSettingsTab.TIMELINE_SETTINGS)}

                    <span className="mx_SettingsTab_subheading">{_t("Room list")}</span>
                    {this._renderGroup(PreferencesUserSettingsTab.ROOM_LIST_SETTINGS)}

                    <span className="mx_SettingsTab_subheading">{_t("Advanced")}</span>
                    {this._renderGroup(PreferencesUserSettingsTab.ADVANCED_SETTINGS)}
                    {minimizeToTrayOption}
                    {autoLaunchOption}
                    <Field id={"autocompleteDelay"} label={_t('Autocomplete delay (ms)')} type='number'
                           value={SettingsStore.getValueAt(SettingLevel.DEVICE, 'autocompleteDelay')}
                           onChange={this._onAutocompleteDelayChange} />
                </div>
            </div>
        );
    }
}
