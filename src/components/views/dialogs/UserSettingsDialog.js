/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import PropTypes from 'prop-types';
import TabbedView, {Tab} from "../../structures/TabbedView";
import {_t, _td} from "../../../languageHandler";
import GeneralUserSettingsTab from "../settings/tabs/user/GeneralUserSettingsTab";
import SettingsStore from "../../../settings/SettingsStore";
import LabsUserSettingsTab from "../settings/tabs/user/LabsUserSettingsTab";
import AppearanceUserSettingsTab from "../settings/tabs/user/AppearanceUserSettingsTab";
import SecurityUserSettingsTab from "../settings/tabs/user/SecurityUserSettingsTab";
import NotificationUserSettingsTab from "../settings/tabs/user/NotificationUserSettingsTab";
import PreferencesUserSettingsTab from "../settings/tabs/user/PreferencesUserSettingsTab";
import VoiceUserSettingsTab from "../settings/tabs/user/VoiceUserSettingsTab";
import HelpUserSettingsTab from "../settings/tabs/user/HelpUserSettingsTab";
import FlairUserSettingsTab from "../settings/tabs/user/FlairUserSettingsTab";
import * as sdk from "../../../index";
import SdkConfig from "../../../SdkConfig";
import MjolnirUserSettingsTab from "../settings/tabs/user/MjolnirUserSettingsTab";

export const USER_GENERAL_TAB = "USER_GENERAL_TAB";
export const USER_APPEARANCE_TAB = "USER_APPEARANCE_TAB";
export const USER_FLAIR_TAB = "USER_FLAIR_TAB";
export const USER_NOTIFICATIONS_TAB = "USER_NOTIFICATIONS_TAB";
export const USER_PREFERENCES_TAB = "USER_PREFERENCES_TAB";
export const USER_VOICE_TAB = "USER_VOICE_TAB";
export const USER_SECURITY_TAB = "USER_SECURITY_TAB";
export const USER_LABS_TAB = "USER_LABS_TAB";
export const USER_MJOLNIR_TAB = "USER_MJOLNIR_TAB";
export const USER_HELP_TAB = "USER_HELP_TAB";

export default class UserSettingsDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
        initialTabId: PropTypes.string,
    };

    constructor() {
        super();

        this.state = {
            mjolnirEnabled: SettingsStore.isFeatureEnabled("feature_mjolnir"),
        };
    }

    componentDidMount(): void {
        this._mjolnirWatcher = SettingsStore.watchSetting("feature_mjolnir", null, this._mjolnirChanged.bind(this));
    }

    componentWillUnmount(): void {
        SettingsStore.unwatchSetting(this._mjolnirWatcher);
    }

    _mjolnirChanged(settingName, roomId, atLevel, newValue) {
        // We can cheat because we know what levels a feature is tracked at, and how it is tracked
        this.setState({mjolnirEnabled: newValue});
    }

    _getTabs() {
        const tabs = [];

        tabs.push(new Tab(
            USER_GENERAL_TAB,
            _td("General"),
            "mx_UserSettingsDialog_settingsIcon",
            <GeneralUserSettingsTab closeSettingsFn={this.props.onFinished} />,
        ));
        tabs.push(new Tab(
            USER_APPEARANCE_TAB,
            _td("Appearance"),
            "mx_UserSettingsDialog_appearanceIcon",
            <AppearanceUserSettingsTab />,
        ));
        tabs.push(new Tab(
            USER_FLAIR_TAB,
            _td("Flair"),
            "mx_UserSettingsDialog_flairIcon",
            <FlairUserSettingsTab />,
        ));
        tabs.push(new Tab(
            USER_NOTIFICATIONS_TAB,
            _td("Notifications"),
            "mx_UserSettingsDialog_bellIcon",
            <NotificationUserSettingsTab />,
        ));
        tabs.push(new Tab(
            USER_PREFERENCES_TAB,
            _td("Preferences"),
            "mx_UserSettingsDialog_preferencesIcon",
            <PreferencesUserSettingsTab />,
        ));
        tabs.push(new Tab(
            USER_VOICE_TAB,
            _td("Voice & Video"),
            "mx_UserSettingsDialog_voiceIcon",
            <VoiceUserSettingsTab />,
        ));
        tabs.push(new Tab(
            USER_SECURITY_TAB,
            _td("Security & Privacy"),
            "mx_UserSettingsDialog_securityIcon",
            <SecurityUserSettingsTab closeSettingsFn={this.props.onFinished} />,
        ));
        if (SdkConfig.get()['showLabsSettings'] || SettingsStore.getLabsFeatures().length > 0) {
            tabs.push(new Tab(
                USER_LABS_TAB,
                _td("Labs"),
                "mx_UserSettingsDialog_labsIcon",
                <LabsUserSettingsTab />,
            ));
        }
        if (this.state.mjolnirEnabled) {
            tabs.push(new Tab(
                USER_MJOLNIR_TAB,
                _td("Ignored users"),
                "mx_UserSettingsDialog_mjolnirIcon",
                <MjolnirUserSettingsTab />,
            ));
        }
        tabs.push(new Tab(
            USER_HELP_TAB,
            _td("Help & About"),
            "mx_UserSettingsDialog_helpIcon",
            <HelpUserSettingsTab closeSettingsFn={this.props.onFinished} />,
        ));

        return tabs;
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        return (
            <BaseDialog className='mx_UserSettingsDialog' hasCancel={true}
                        onFinished={this.props.onFinished} title={_t("Settings")}>
                <div className='ms_SettingsDialog_content'>
                    <TabbedView tabs={this._getTabs()} initialTabId={this.props.initialTabId} />
                </div>
            </BaseDialog>
        );
    }
}
