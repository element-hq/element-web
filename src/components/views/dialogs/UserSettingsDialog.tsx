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

import React from "react";

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
import SdkConfig from "../../../SdkConfig";
import MjolnirUserSettingsTab from "../settings/tabs/user/MjolnirUserSettingsTab";
import { UIFeature } from "../../../settings/UIFeature";
import BaseDialog from "./BaseDialog";
import SidebarUserSettingsTab from "../settings/tabs/user/SidebarUserSettingsTab";
import KeyboardUserSettingsTab from "../settings/tabs/user/KeyboardUserSettingsTab";
import SessionManagerTab from "../settings/tabs/user/SessionManagerTab";
import { UserTab } from "./UserTab";
import { NonEmptyArray } from "../../../@types/common";

interface IProps {
    initialTabId?: UserTab;
    onFinished(): void;
}

interface IState {
    mjolnirEnabled: boolean;
}

export default class UserSettingsDialog extends React.Component<IProps, IState> {
    private settingsWatchers: string[] = [];

    public constructor(props: IProps) {
        super(props);

        this.state = {
            mjolnirEnabled: SettingsStore.getValue("feature_mjolnir"),
        };
    }

    public componentDidMount(): void {
        this.settingsWatchers = [SettingsStore.watchSetting("feature_mjolnir", null, this.mjolnirChanged)];
    }

    public componentWillUnmount(): void {
        this.settingsWatchers.forEach((watcherRef) => SettingsStore.unwatchSetting(watcherRef));
    }

    private mjolnirChanged: CallbackFn = (settingName, roomId, atLevel, newValue) => {
        // We can cheat because we know what levels a feature is tracked at, and how it is tracked
        this.setState({ mjolnirEnabled: newValue });
    };

    private getTabs(): NonEmptyArray<Tab<UserTab>> {
        const tabs: Tab<UserTab>[] = [];

        tabs.push(
            new Tab(
                UserTab.General,
                _td("General"),
                "mx_UserSettingsDialog_settingsIcon",
                <GeneralUserSettingsTab closeSettingsFn={this.props.onFinished} />,
                "UserSettingsGeneral",
            ),
        );
        tabs.push(
            new Tab(
                UserTab.Appearance,
                _td("Appearance"),
                "mx_UserSettingsDialog_appearanceIcon",
                <AppearanceUserSettingsTab />,
                "UserSettingsAppearance",
            ),
        );
        tabs.push(
            new Tab(
                UserTab.Notifications,
                _td("Notifications"),
                "mx_UserSettingsDialog_bellIcon",
                <NotificationUserSettingsTab />,
                "UserSettingsNotifications",
            ),
        );
        tabs.push(
            new Tab(
                UserTab.Preferences,
                _td("Preferences"),
                "mx_UserSettingsDialog_preferencesIcon",
                <PreferencesUserSettingsTab closeSettingsFn={this.props.onFinished} />,
                "UserSettingsPreferences",
            ),
        );
        tabs.push(
            new Tab(
                UserTab.Keyboard,
                _td("Keyboard"),
                "mx_UserSettingsDialog_keyboardIcon",
                <KeyboardUserSettingsTab />,
                "UserSettingsKeyboard",
            ),
        );
        tabs.push(
            new Tab(
                UserTab.Sidebar,
                _td("Sidebar"),
                "mx_UserSettingsDialog_sidebarIcon",
                <SidebarUserSettingsTab />,
                "UserSettingsSidebar",
            ),
        );

        if (SettingsStore.getValue(UIFeature.Voip)) {
            tabs.push(
                new Tab(
                    UserTab.Voice,
                    _td("Voice & Video"),
                    "mx_UserSettingsDialog_voiceIcon",
                    <VoiceUserSettingsTab />,
                    "UserSettingsVoiceVideo",
                ),
            );
        }

        tabs.push(
            new Tab(
                UserTab.Security,
                _td("Security & Privacy"),
                "mx_UserSettingsDialog_securityIcon",
                <SecurityUserSettingsTab closeSettingsFn={this.props.onFinished} />,
                "UserSettingsSecurityPrivacy",
            ),
        );
        tabs.push(
            new Tab(
                UserTab.SessionManager,
                _td("Sessions"),
                "mx_UserSettingsDialog_sessionsIcon",
                <SessionManagerTab />,
                // don't track with posthog while under construction
                undefined,
            ),
        );
        // Show the Labs tab if enabled or if there are any active betas
        if (
            SdkConfig.get("show_labs_settings") ||
            SettingsStore.getFeatureSettingNames().some((k) => SettingsStore.getBetaInfo(k))
        ) {
            tabs.push(
                new Tab(
                    UserTab.Labs,
                    _td("Labs"),
                    "mx_UserSettingsDialog_labsIcon",
                    <LabsUserSettingsTab />,
                    "UserSettingsLabs",
                ),
            );
        }
        if (this.state.mjolnirEnabled) {
            tabs.push(
                new Tab(
                    UserTab.Mjolnir,
                    _td("Ignored users"),
                    "mx_UserSettingsDialog_mjolnirIcon",
                    <MjolnirUserSettingsTab />,
                    "UserSettingMjolnir",
                ),
            );
        }
        tabs.push(
            new Tab(
                UserTab.Help,
                _td("Help & About"),
                "mx_UserSettingsDialog_helpIcon",
                <HelpUserSettingsTab closeSettingsFn={() => this.props.onFinished()} />,
                "UserSettingsHelpAbout",
            ),
        );

        return tabs as NonEmptyArray<Tab<UserTab>>;
    }

    public render(): React.ReactNode {
        return (
            <BaseDialog
                className="mx_UserSettingsDialog"
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={_t("Settings")}
            >
                <div className="mx_SettingsDialog_content">
                    <TabbedView
                        tabs={this.getTabs()}
                        initialTabId={this.props.initialTabId}
                        screenName="UserSettings"
                    />
                </div>
            </BaseDialog>
        );
    }
}
