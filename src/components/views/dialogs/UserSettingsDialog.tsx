/*
Copyright 2019 New Vector Ltd
Copyright 2019, 2024 The Matrix.org Foundation C.I.C.

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

import { Toast } from "@vector-im/compound-web";
import React, { useState } from "react";

import TabbedView, { Tab, useActiveTabWithDefault } from "../../structures/TabbedView";
import { _t, _td } from "../../../languageHandler";
import GeneralUserSettingsTab from "../settings/tabs/user/GeneralUserSettingsTab";
import SettingsStore from "../../../settings/SettingsStore";
import LabsUserSettingsTab, { showLabsFlags } from "../settings/tabs/user/LabsUserSettingsTab";
import AppearanceUserSettingsTab from "../settings/tabs/user/AppearanceUserSettingsTab";
import SecurityUserSettingsTab from "../settings/tabs/user/SecurityUserSettingsTab";
import NotificationUserSettingsTab from "../settings/tabs/user/NotificationUserSettingsTab";
import PreferencesUserSettingsTab from "../settings/tabs/user/PreferencesUserSettingsTab";
import VoiceUserSettingsTab from "../settings/tabs/user/VoiceUserSettingsTab";
import HelpUserSettingsTab from "../settings/tabs/user/HelpUserSettingsTab";
import MjolnirUserSettingsTab from "../settings/tabs/user/MjolnirUserSettingsTab";
import { UIFeature } from "../../../settings/UIFeature";
import BaseDialog from "./BaseDialog";
import SidebarUserSettingsTab from "../settings/tabs/user/SidebarUserSettingsTab";
import KeyboardUserSettingsTab from "../settings/tabs/user/KeyboardUserSettingsTab";
import SessionManagerTab from "../settings/tabs/user/SessionManagerTab";
import { UserTab } from "./UserTab";
import { NonEmptyArray } from "../../../@types/common";
import { SDKContext, SdkContextClass } from "../../../contexts/SDKContext";
import { useSettingValue } from "../../../hooks/useSettings";
import { ToastContext, useActiveToast } from "../../../contexts/ToastContext";

interface IProps {
    initialTabId?: UserTab;
    showMsc4108QrCode?: boolean;
    sdkContext: SdkContextClass;
    onFinished(): void;
}

function titleForTabID(tabId: UserTab): React.ReactNode {
    const subs = {
        strong: (sub: string) => <strong>{sub}</strong>,
    };
    switch (tabId) {
        case UserTab.General:
            return _t("settings|general|dialog_title", undefined, subs);
        case UserTab.SessionManager:
            return _t("settings|sessions|dialog_title", undefined, subs);
        case UserTab.Appearance:
            return _t("settings|appearance|dialog_title", undefined, subs);
        case UserTab.Notifications:
            return _t("settings|notifications|dialog_title", undefined, subs);
        case UserTab.Preferences:
            return _t("settings|preferences|dialog_title", undefined, subs);
        case UserTab.Keyboard:
            return _t("settings|keyboard|dialog_title", undefined, subs);
        case UserTab.Sidebar:
            return _t("settings|sidebar|dialog_title", undefined, subs);
        case UserTab.Voice:
            return _t("settings|voip|dialog_title", undefined, subs);
        case UserTab.Security:
            return _t("settings|security|dialog_title", undefined, subs);
        case UserTab.Labs:
            return _t("settings|labs|dialog_title", undefined, subs);
        case UserTab.Mjolnir:
            return _t("settings|labs_mjolnir|dialog_title", undefined, subs);
        case UserTab.Help:
            return _t("setting|help_about|dialog_title", undefined, subs);
    }
}

export default function UserSettingsDialog(props: IProps): JSX.Element {
    const voipEnabled = useSettingValue<boolean>(UIFeature.Voip);
    const mjolnirEnabled = useSettingValue<boolean>("feature_mjolnir");
    // store this prop in state as changing tabs back and forth should clear it
    const [showMsc4108QrCode, setShowMsc4108QrCode] = useState(props.showMsc4108QrCode);

    const getTabs = (): NonEmptyArray<Tab<UserTab>> => {
        const tabs: Tab<UserTab>[] = [];

        tabs.push(
            new Tab(
                UserTab.General,
                _td("common|general"),
                "mx_UserSettingsDialog_settingsIcon",
                <GeneralUserSettingsTab closeSettingsFn={props.onFinished} />,
                "UserSettingsGeneral",
            ),
        );
        tabs.push(
            new Tab(
                UserTab.SessionManager,
                _td("settings|sessions|title"),
                "mx_UserSettingsDialog_sessionsIcon",
                <SessionManagerTab showMsc4108QrCode={showMsc4108QrCode} />,
                undefined,
            ),
        );
        tabs.push(
            new Tab(
                UserTab.Appearance,
                _td("common|appearance"),
                "mx_UserSettingsDialog_appearanceIcon",
                <AppearanceUserSettingsTab />,
                "UserSettingsAppearance",
            ),
        );
        tabs.push(
            new Tab(
                UserTab.Notifications,
                _td("notifications|enable_prompt_toast_title"),
                "mx_UserSettingsDialog_bellIcon",
                <NotificationUserSettingsTab />,
                "UserSettingsNotifications",
            ),
        );
        tabs.push(
            new Tab(
                UserTab.Preferences,
                _td("common|preferences"),
                "mx_UserSettingsDialog_preferencesIcon",
                <PreferencesUserSettingsTab closeSettingsFn={props.onFinished} />,
                "UserSettingsPreferences",
            ),
        );
        tabs.push(
            new Tab(
                UserTab.Keyboard,
                _td("settings|keyboard|title"),
                "mx_UserSettingsDialog_keyboardIcon",
                <KeyboardUserSettingsTab />,
                "UserSettingsKeyboard",
            ),
        );
        tabs.push(
            new Tab(
                UserTab.Sidebar,
                _td("settings|sidebar|title"),
                "mx_UserSettingsDialog_sidebarIcon",
                <SidebarUserSettingsTab />,
                "UserSettingsSidebar",
            ),
        );

        if (voipEnabled) {
            tabs.push(
                new Tab(
                    UserTab.Voice,
                    _td("settings|voip|title"),
                    "mx_UserSettingsDialog_voiceIcon",
                    <VoiceUserSettingsTab />,
                    "UserSettingsVoiceVideo",
                ),
            );
        }

        tabs.push(
            new Tab(
                UserTab.Security,
                _td("room_settings|security|title"),
                "mx_UserSettingsDialog_securityIcon",
                <SecurityUserSettingsTab closeSettingsFn={props.onFinished} />,
                "UserSettingsSecurityPrivacy",
            ),
        );

        if (showLabsFlags() || SettingsStore.getFeatureSettingNames().some((k) => SettingsStore.getBetaInfo(k))) {
            tabs.push(
                new Tab(
                    UserTab.Labs,
                    _td("common|labs"),
                    "mx_UserSettingsDialog_labsIcon",
                    <LabsUserSettingsTab />,
                    "UserSettingsLabs",
                ),
            );
        }
        if (mjolnirEnabled) {
            tabs.push(
                new Tab(
                    UserTab.Mjolnir,
                    _td("labs_mjolnir|title"),
                    "mx_UserSettingsDialog_mjolnirIcon",
                    <MjolnirUserSettingsTab />,
                    "UserSettingMjolnir",
                ),
            );
        }
        tabs.push(
            new Tab(
                UserTab.Help,
                _td("setting|help_about|title"),
                "mx_UserSettingsDialog_helpIcon",
                <HelpUserSettingsTab />,
                "UserSettingsHelpAbout",
            ),
        );

        return tabs as NonEmptyArray<Tab<UserTab>>;
    };

    const [activeTabId, _setActiveTabId] = useActiveTabWithDefault(getTabs(), UserTab.General, props.initialTabId);
    const setActiveTabId = (tabId: UserTab): void => {
        _setActiveTabId(tabId);
        // Clear this so switching away from the tab and back to it will not show the QR code again
        setShowMsc4108QrCode(false);
    };

    const [activeToast, toastRack] = useActiveToast();

    return (
        // XXX: SDKContext is provided within the LoggedInView subtree.
        // Modals function outside the MatrixChat React tree, so sdkContext is reprovided here to simulate that.
        // The longer term solution is to move our ModalManager into the React tree to inherit contexts properly.
        <SDKContext.Provider value={props.sdkContext}>
            <ToastContext.Provider value={toastRack}>
                <BaseDialog
                    className="mx_UserSettingsDialog"
                    hasCancel={true}
                    onFinished={props.onFinished}
                    title={titleForTabID(activeTabId)}
                >
                    <div className="mx_SettingsDialog_content">
                        <TabbedView
                            tabs={getTabs()}
                            activeTabId={activeTabId}
                            screenName="UserSettings"
                            onChange={setActiveTabId}
                            responsive={true}
                        />
                    </div>
                    <div className="mx_SettingsDialog_toastContainer">
                        {activeToast && <Toast>{activeToast}</Toast>}
                    </div>
                </BaseDialog>
            </ToastContext.Provider>
        </SDKContext.Provider>
    );
}
