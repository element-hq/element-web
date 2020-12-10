/*
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import SettingsStore from "../../../../../settings/SettingsStore";
import Field from "../../../elements/Field";
import * as sdk from "../../../../..";
import PlatformPeg from "../../../../../PlatformPeg";
import {SettingLevel} from "../../../../../settings/SettingLevel";

export default class PreferencesUserSettingsTab extends React.Component {
    static ROOM_LIST_SETTINGS = [
        'breadcrumbs',
    ];

    static COMPOSER_SETTINGS = [
        'MessageComposerInput.autoReplaceEmoji',
        'MessageComposerInput.suggestEmoji',
        'sendTypingNotifications',
        'MessageComposerInput.ctrlEnterToSend',
    ];

    static TIMELINE_SETTINGS = [
        'showTypingNotifications',
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
        'showImages',
        'showChatEffects',
        'Pill.shouldShowPillAvatar',
    ];

    static GENERAL_SETTINGS = [
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
            alwaysShowMenuBar: true,
            alwaysShowMenuBarSupported: false,
            minimizeToTray: true,
            minimizeToTraySupported: false,
            autocompleteDelay:
                SettingsStore.getValueAt(SettingLevel.DEVICE, 'autocompleteDelay').toString(10),
            readMarkerInViewThresholdMs:
                SettingsStore.getValueAt(SettingLevel.DEVICE, 'readMarkerInViewThresholdMs').toString(10),
            readMarkerOutOfViewThresholdMs:
                SettingsStore.getValueAt(SettingLevel.DEVICE, 'readMarkerOutOfViewThresholdMs').toString(10),
        };
    }

    async componentDidMount(): void {
        const platform = PlatformPeg.get();

        const autoLaunchSupported = await platform.supportsAutoLaunch();
        let autoLaunch = false;
        if (autoLaunchSupported) {
            autoLaunch = await platform.getAutoLaunchEnabled();
        }

        const alwaysShowMenuBarSupported = await platform.supportsAutoHideMenuBar();
        let alwaysShowMenuBar = true;
        if (alwaysShowMenuBarSupported) {
            alwaysShowMenuBar = !await platform.getAutoHideMenuBarEnabled();
        }

        const minimizeToTraySupported = await platform.supportsMinimizeToTray();
        let minimizeToTray = true;
        if (minimizeToTraySupported) {
            minimizeToTray = await platform.getMinimizeToTrayEnabled();
        }

        this.setState({
            autoLaunch,
            autoLaunchSupported,
            alwaysShowMenuBarSupported,
            alwaysShowMenuBar,
            minimizeToTraySupported,
            minimizeToTray,
        });
    }

    _onAutoLaunchChange = (checked) => {
        PlatformPeg.get().setAutoLaunchEnabled(checked).then(() => this.setState({autoLaunch: checked}));
    };

    _onAlwaysShowMenuBarChange = (checked) => {
        PlatformPeg.get().setAutoHideMenuBarEnabled(!checked).then(() => this.setState({alwaysShowMenuBar: checked}));
    };

    _onMinimizeToTrayChange = (checked) => {
        PlatformPeg.get().setMinimizeToTrayEnabled(checked).then(() => this.setState({minimizeToTray: checked}));
    };

    _onAutocompleteDelayChange = (e) => {
        this.setState({autocompleteDelay: e.target.value});
        SettingsStore.setValue("autocompleteDelay", null, SettingLevel.DEVICE, e.target.value);
    };

    _onReadMarkerInViewThresholdMs = (e) => {
        this.setState({readMarkerInViewThresholdMs: e.target.value});
        SettingsStore.setValue("readMarkerInViewThresholdMs", null, SettingLevel.DEVICE, e.target.value);
    };

    _onReadMarkerOutOfViewThresholdMs = (e) => {
        this.setState({readMarkerOutOfViewThresholdMs: e.target.value});
        SettingsStore.setValue("readMarkerOutOfViewThresholdMs", null, SettingLevel.DEVICE, e.target.value);
    };

    _renderGroup(settingIds) {
        const SettingsFlag = sdk.getComponent("views.elements.SettingsFlag");
        return settingIds.filter(SettingsStore.isEnabled).map(i => {
            return <SettingsFlag key={i} name={i} level={SettingLevel.ACCOUNT} />;
        });
    }

    render() {
        let autoLaunchOption = null;
        if (this.state.autoLaunchSupported) {
            autoLaunchOption = <LabelledToggleSwitch
                value={this.state.autoLaunch}
                onChange={this._onAutoLaunchChange}
                label={_t('Start automatically after system login')} />;
        }

        let autoHideMenuOption = null;
        if (this.state.alwaysShowMenuBarSupported) {
            autoHideMenuOption = <LabelledToggleSwitch
                value={this.state.alwaysShowMenuBar}
                onChange={this._onAlwaysShowMenuBarChange}
                label={_t('Always show the window menu bar')} />;
        }

        let minimizeToTrayOption = null;
        if (this.state.minimizeToTraySupported) {
            minimizeToTrayOption = <LabelledToggleSwitch
                value={this.state.minimizeToTray}
                onChange={this._onMinimizeToTrayChange}
                label={_t('Show tray icon and minimize window to it on close')} />;
        }

        return (
            <div className="mx_SettingsTab mx_PreferencesUserSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Preferences")}</div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Room list")}</span>
                    {this._renderGroup(PreferencesUserSettingsTab.ROOM_LIST_SETTINGS)}
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Composer")}</span>
                    {this._renderGroup(PreferencesUserSettingsTab.COMPOSER_SETTINGS)}
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Timeline")}</span>
                    {this._renderGroup(PreferencesUserSettingsTab.TIMELINE_SETTINGS)}
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("General")}</span>
                    {this._renderGroup(PreferencesUserSettingsTab.GENERAL_SETTINGS)}
                    {minimizeToTrayOption}
                    {autoHideMenuOption}
                    {autoLaunchOption}
                    <Field
                        label={_t('Autocomplete delay (ms)')}
                        type='number'
                        value={this.state.autocompleteDelay}
                        onChange={this._onAutocompleteDelayChange} />
                    <Field
                        label={_t('Read Marker lifetime (ms)')}
                        type='number'
                        value={this.state.readMarkerInViewThresholdMs}
                        onChange={this._onReadMarkerInViewThresholdMs} />
                    <Field
                        label={_t('Read Marker off-screen lifetime (ms)')}
                        type='number'
                        value={this.state.readMarkerOutOfViewThresholdMs}
                        onChange={this._onReadMarkerOutOfViewThresholdMs} />
                </div>
            </div>
        );
    }
}
