/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.
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
import { replaceableComponent } from "../../../../../utils/replaceableComponent";

interface IState {
    autoLaunch: boolean;
    autoLaunchSupported: boolean;
    warnBeforeExit: boolean;
    warnBeforeExitSupported: boolean;
    alwaysShowMenuBarSupported: boolean;
    alwaysShowMenuBar: boolean;
    minimizeToTraySupported: boolean;
    minimizeToTray: boolean;
    autocompleteDelay: string;
    readMarkerInViewThresholdMs: string;
    readMarkerOutOfViewThresholdMs: string;
}

@replaceableComponent("views.settings.tabs.user.PreferencesUserSettingsTab")
export default class PreferencesUserSettingsTab extends React.Component<{}, IState> {
    static ROOM_LIST_SETTINGS = [
        'breadcrumbs',
    ];

    static COMPOSER_SETTINGS = [
        'MessageComposerInput.autoReplaceEmoji',
        'MessageComposerInput.suggestEmoji',
        'sendTypingNotifications',
        'MessageComposerInput.ctrlEnterToSend',
        'MessageComposerInput.showStickersButton',
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
        'expandCodeByDefault',
        'scrollToBottomOnMessageSent',
        'showCodeLineNumbers',
        'showJoinLeaves',
        'showAvatarChanges',
        'showDisplaynameChanges',
        'showImages',
        'showChatEffects',
        'Pill.shouldShowPillAvatar',
        'ctrlFForSearch',
    ];

    static GENERAL_SETTINGS = [
        'TagPanel.enableTagPanel',
        'promptBeforeInviteUnknownUsers',
        // Start automatically after startup (electron-only)
        // Autocomplete delay (niche text box)
    ];

    constructor(props) {
        super(props);

        this.state = {
            autoLaunch: false,
            autoLaunchSupported: false,
            warnBeforeExit: true,
            warnBeforeExitSupported: false,
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

    async componentDidMount() {
        const platform = PlatformPeg.get();

        const autoLaunchSupported = await platform.supportsAutoLaunch();
        let autoLaunch = false;
        if (autoLaunchSupported) {
            autoLaunch = await platform.getAutoLaunchEnabled();
        }

        const warnBeforeExitSupported = await platform.supportsWarnBeforeExit();
        let warnBeforeExit = false;
        if (warnBeforeExitSupported) {
            warnBeforeExit = await platform.shouldWarnBeforeExit();
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
            warnBeforeExit,
            warnBeforeExitSupported,
            alwaysShowMenuBarSupported,
            alwaysShowMenuBar,
            minimizeToTraySupported,
            minimizeToTray,
        });
    }

    private onAutoLaunchChange = (checked: boolean) => {
        PlatformPeg.get().setAutoLaunchEnabled(checked).then(() => this.setState({autoLaunch: checked}));
    };

    private onWarnBeforeExitChange = (checked: boolean) => {
        PlatformPeg.get().setWarnBeforeExit(checked).then(() => this.setState({warnBeforeExit: checked}));
    }

    private onAlwaysShowMenuBarChange = (checked: boolean) => {
        PlatformPeg.get().setAutoHideMenuBarEnabled(!checked).then(() => this.setState({alwaysShowMenuBar: checked}));
    };

    private onMinimizeToTrayChange = (checked: boolean) => {
        PlatformPeg.get().setMinimizeToTrayEnabled(checked).then(() => this.setState({minimizeToTray: checked}));
    };

    private onAutocompleteDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({autocompleteDelay: e.target.value});
        SettingsStore.setValue("autocompleteDelay", null, SettingLevel.DEVICE, e.target.value);
    };

    private onReadMarkerInViewThresholdMs = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({readMarkerInViewThresholdMs: e.target.value});
        SettingsStore.setValue("readMarkerInViewThresholdMs", null, SettingLevel.DEVICE, e.target.value);
    };

    private onReadMarkerOutOfViewThresholdMs = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({readMarkerOutOfViewThresholdMs: e.target.value});
        SettingsStore.setValue("readMarkerOutOfViewThresholdMs", null, SettingLevel.DEVICE, e.target.value);
    };

    private renderGroup(settingIds: string[]): React.ReactNodeArray {
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
                onChange={this.onAutoLaunchChange}
                label={_t('Start automatically after system login')} />;
        }

        let warnBeforeExitOption = null;
        if (this.state.warnBeforeExitSupported) {
            warnBeforeExitOption = <LabelledToggleSwitch
                value={this.state.warnBeforeExit}
                onChange={this.onWarnBeforeExitChange}
                label={_t('Warn before quitting')} />;
        }

        let autoHideMenuOption = null;
        if (this.state.alwaysShowMenuBarSupported) {
            autoHideMenuOption = <LabelledToggleSwitch
                value={this.state.alwaysShowMenuBar}
                onChange={this.onAlwaysShowMenuBarChange}
                label={_t('Always show the window menu bar')} />;
        }

        let minimizeToTrayOption = null;
        if (this.state.minimizeToTraySupported) {
            minimizeToTrayOption = <LabelledToggleSwitch
                value={this.state.minimizeToTray}
                onChange={this.onMinimizeToTrayChange}
                label={_t('Show tray icon and minimize window to it on close')} />;
        }

        return (
            <div className="mx_SettingsTab mx_PreferencesUserSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Preferences")}</div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Room list")}</span>
                    {this.renderGroup(PreferencesUserSettingsTab.ROOM_LIST_SETTINGS)}
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Composer")}</span>
                    {this.renderGroup(PreferencesUserSettingsTab.COMPOSER_SETTINGS)}
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Timeline")}</span>
                    {this.renderGroup(PreferencesUserSettingsTab.TIMELINE_SETTINGS)}
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("General")}</span>
                    {this.renderGroup(PreferencesUserSettingsTab.GENERAL_SETTINGS)}
                    {minimizeToTrayOption}
                    {autoHideMenuOption}
                    {autoLaunchOption}
                    {warnBeforeExitOption}
                    <Field
                        label={_t('Autocomplete delay (ms)')}
                        type='number'
                        value={this.state.autocompleteDelay}
                        onChange={this.onAutocompleteDelayChange} />
                    <Field
                        label={_t('Read Marker lifetime (ms)')}
                        type='number'
                        value={this.state.readMarkerInViewThresholdMs}
                        onChange={this.onReadMarkerInViewThresholdMs} />
                    <Field
                        label={_t('Read Marker off-screen lifetime (ms)')}
                        type='number'
                        value={this.state.readMarkerOutOfViewThresholdMs}
                        onChange={this.onReadMarkerOutOfViewThresholdMs} />
                </div>
            </div>
        );
    }
}
