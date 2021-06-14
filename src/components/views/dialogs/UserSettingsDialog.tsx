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
import {UIFeature} from "../../../settings/UIFeature";
import {replaceableComponent} from "../../../utils/replaceableComponent";

export enum USER_TAB {
    GENERAL = "USER_GENERAL_TAB",
    APPEARANCE = "USER_APPEARANCE_TAB",
    FLAIR = "USER_FLAIR_TAB",
    NOTIFICATIONS = "USER_NOTIFICATIONS_TAB",
    PREFERENCES = "USER_PREFERENCES_TAB",
    VOICE = "USER_VOICE_TAB",
    SECURITY = "USER_SECURITY_TAB",
    LABS = "USER_LABS_TAB",
    MJOLNIR = "USER_MJOLNIR_TAB",
    HELP = "USER_HELP_TAB",
}

interface IProps {
    onFinished: (success: boolean) => void;
    initialTabId?: string;
}

interface IState {
    mjolnirEnabled: boolean;
}

@replaceableComponent("views.dialogs.UserSettingsDialog")
export default class UserSettingsDialog extends React.Component<IProps, IState> {
    private mjolnirWatcher: string;

    constructor(props) {
        super(props);

        this.state = {
            mjolnirEnabled: SettingsStore.getValue("feature_mjolnir"),
        };
    }

    public componentDidMount(): void {
        this.mjolnirWatcher = SettingsStore.watchSetting("feature_mjolnir", null, this.mjolnirChanged);
    }

    public componentWillUnmount(): void {
        SettingsStore.unwatchSetting(this.mjolnirWatcher);
    }

    private mjolnirChanged = (settingName, roomId, atLevel, newValue: boolean) => {
        // We can cheat because we know what levels a feature is tracked at, and how it is tracked
        this.setState({mjolnirEnabled: newValue});
    }

    _getTabs() {
        const tabs = [];

        tabs.push(new Tab(
            USER_TAB.GENERAL,
            _td("General"),
            "mx_UserSettingsDialog_settingsIcon",
            <GeneralUserSettingsTab closeSettingsFn={this.props.onFinished} />,
        ));
        tabs.push(new Tab(
            USER_TAB.APPEARANCE,
            _td("Appearance"),
            "mx_UserSettingsDialog_appearanceIcon",
            <AppearanceUserSettingsTab />,
        ));
        if (SettingsStore.getValue(UIFeature.Flair)) {
            tabs.push(new Tab(
                USER_TAB.FLAIR,
                _td("Flair"),
                "mx_UserSettingsDialog_flairIcon",
                <FlairUserSettingsTab />,
            ));
        }
        tabs.push(new Tab(
            USER_TAB.NOTIFICATIONS,
            _td("Notifications"),
            "mx_UserSettingsDialog_bellIcon",
            <NotificationUserSettingsTab />,
        ));
        tabs.push(new Tab(
            USER_TAB.PREFERENCES,
            _td("Preferences"),
            "mx_UserSettingsDialog_preferencesIcon",
            <PreferencesUserSettingsTab />,
        ));

        if (SettingsStore.getValue(UIFeature.Voip)) {
            tabs.push(new Tab(
                USER_TAB.VOICE,
                _td("Voice & Video"),
                "mx_UserSettingsDialog_voiceIcon",
                <VoiceUserSettingsTab />,
            ));
        }

        tabs.push(new Tab(
            USER_TAB.SECURITY,
            _td("Security & Privacy"),
            "mx_UserSettingsDialog_securityIcon",
            <SecurityUserSettingsTab closeSettingsFn={this.props.onFinished} />,
        ));
        // Show the Labs tab if enabled or if there are any active betas
        if (SdkConfig.get()['showLabsSettings']
            || SettingsStore.getFeatureSettingNames().some(k => SettingsStore.getBetaInfo(k))
        ) {
            tabs.push(new Tab(
                USER_TAB.LABS,
                _td("Labs"),
                "mx_UserSettingsDialog_labsIcon",
                <LabsUserSettingsTab />,
            ));
        }
        if (this.state.mjolnirEnabled) {
            tabs.push(new Tab(
                USER_TAB.MJOLNIR,
                _td("Ignored users"),
                "mx_UserSettingsDialog_mjolnirIcon",
                <MjolnirUserSettingsTab />,
            ));
        }
        tabs.push(new Tab(
            USER_TAB.HELP,
            _td("Help & About"),
            "mx_UserSettingsDialog_helpIcon",
            <HelpUserSettingsTab closeSettingsFn={() => this.props.onFinished(true)} />,
        ));

        return tabs;
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        return (
            <BaseDialog
                className='mx_UserSettingsDialog'
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={_t("Settings")}
            >
                <div className='mx_SettingsDialog_content'>
                    <TabbedView tabs={this._getTabs()} initialTabId={this.props.initialTabId} />
                </div>
            </BaseDialog>
        );
    }
}
