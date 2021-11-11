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
import TabbedView, { Tab } from "../../structures/TabbedView";
import { _t, _td } from "../../../languageHandler";
import GeneralUserSettingsTab from "../settings/tabs/user/GeneralUserSettingsTab";
import SettingsStore, { CallbackFn } from "../../../settings/SettingsStore";
import LabsUserSettingsTab from "../settings/tabs/user/LabsUserSettingsTab";
import AppearanceUserSettingsTab from "../settings/tabs/user/AppearanceUserSettingsTab";
import SecurityUserSettingsTab from "../settings/tabs/user/SecurityUserSettingsTab";
import NotificationUserSettingsTab from "../settings/tabs/user/NotificationUserSettingsTab";
import PreferencesUserSettingsTab from "../settings/tabs/user/PreferencesUserSettingsTab";
import VoiceUserSettingsTab from "../settings/tabs/user/VoiceUserSettingsTab";
import HelpUserSettingsTab from "../settings/tabs/user/HelpUserSettingsTab";
import FlairUserSettingsTab from "../settings/tabs/user/FlairUserSettingsTab";
import SdkConfig from "../../../SdkConfig";
import MjolnirUserSettingsTab from "../settings/tabs/user/MjolnirUserSettingsTab";
import { UIFeature } from "../../../settings/UIFeature";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import BaseDialog from "./BaseDialog";
import { IDialogProps } from "./IDialogProps";
import SidebarUserSettingsTab from "../settings/tabs/user/SidebarUserSettingsTab";

export enum UserTab {
    General = "USER_GENERAL_TAB",
    Appearance = "USER_APPEARANCE_TAB",
    Flair = "USER_FLAIR_TAB",
    Notifications = "USER_NOTIFICATIONS_TAB",
    Preferences = "USER_PREFERENCES_TAB",
    Sidebar = "USER_SIDEBAR_TAB",
    Voice = "USER_VOICE_TAB",
    Security = "USER_SECURITY_TAB",
    Labs = "USER_LABS_TAB",
    Mjolnir = "USER_MJOLNIR_TAB",
    Help = "USER_HELP_TAB",
}

interface IProps extends IDialogProps {
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

    private mjolnirChanged: CallbackFn = (settingName, roomId, atLevel, newValue) => {
        // We can cheat because we know what levels a feature is tracked at, and how it is tracked
        this.setState({ mjolnirEnabled: newValue });
    };

    private getTabs() {
        const tabs = [];

        tabs.push(new Tab(
            UserTab.General,
            _td("General"),
            "mx_UserSettingsDialog_settingsIcon",
            <GeneralUserSettingsTab closeSettingsFn={this.props.onFinished} />,
        ));
        tabs.push(new Tab(
            UserTab.Appearance,
            _td("Appearance"),
            "mx_UserSettingsDialog_appearanceIcon",
            <AppearanceUserSettingsTab />,
        ));
        if (SettingsStore.getValue(UIFeature.Flair)) {
            tabs.push(new Tab(
                UserTab.Flair,
                _td("Flair"),
                "mx_UserSettingsDialog_flairIcon",
                <FlairUserSettingsTab />,
            ));
        }
        tabs.push(new Tab(
            UserTab.Notifications,
            _td("Notifications"),
            "mx_UserSettingsDialog_bellIcon",
            <NotificationUserSettingsTab />,
        ));
        tabs.push(new Tab(
            UserTab.Preferences,
            _td("Preferences"),
            "mx_UserSettingsDialog_preferencesIcon",
            <PreferencesUserSettingsTab closeSettingsFn={this.props.onFinished} />,
        ));

        if (SettingsStore.getValue("feature_spaces_metaspaces")) {
            tabs.push(new Tab(
                UserTab.Sidebar,
                _td("Sidebar"),
                "mx_UserSettingsDialog_sidebarIcon",
                <SidebarUserSettingsTab />,
            ));
        }

        if (SettingsStore.getValue(UIFeature.Voip)) {
            tabs.push(new Tab(
                UserTab.Voice,
                _td("Voice & Video"),
                "mx_UserSettingsDialog_voiceIcon",
                <VoiceUserSettingsTab />,
            ));
        }

        tabs.push(new Tab(
            UserTab.Security,
            _td("Security & Privacy"),
            "mx_UserSettingsDialog_securityIcon",
            <SecurityUserSettingsTab closeSettingsFn={this.props.onFinished} />,
        ));
        // Show the Labs tab if enabled or if there are any active betas
        if (SdkConfig.get()['showLabsSettings']
            || SettingsStore.getFeatureSettingNames().some(k => SettingsStore.getBetaInfo(k))
        ) {
            tabs.push(new Tab(
                UserTab.Labs,
                _td("Labs"),
                "mx_UserSettingsDialog_labsIcon",
                <LabsUserSettingsTab />,
            ));
        }
        if (this.state.mjolnirEnabled) {
            tabs.push(new Tab(
                UserTab.Mjolnir,
                _td("Ignored users"),
                "mx_UserSettingsDialog_mjolnirIcon",
                <MjolnirUserSettingsTab />,
            ));
        }
        tabs.push(new Tab(
            UserTab.Help,
            _td("Help & About"),
            "mx_UserSettingsDialog_helpIcon",
            <HelpUserSettingsTab closeSettingsFn={() => this.props.onFinished(true)} />,
        ));

        return tabs;
    }

    render() {
        return (
            <BaseDialog
                className='mx_UserSettingsDialog'
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={_t("Settings")}
            >
                <div className='mx_SettingsDialog_content'>
                    <TabbedView tabs={this.getTabs()} initialTabId={this.props.initialTabId} />
                </div>
            </BaseDialog>
        );
    }
}
