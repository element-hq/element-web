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
import PropTypes from 'prop-types';
import {Tab, TabbedView} from "../../structures/TabbedView";
import {_t, _td} from "../../../languageHandler";
import GeneralUserSettingsTab from "../settings/tabs/GeneralUserSettingsTab";
import dis from '../../../dispatcher';
import SettingsStore from "../../../settings/SettingsStore";
import LabsSettingsTab from "../settings/tabs/LabsSettingsTab";
import SecuritySettingsTab from "../settings/tabs/SecuritySettingsTab";
import NotificationSettingsTab from "../settings/tabs/NotificationSettingsTab";
import PreferencesSettingsTab from "../settings/tabs/PreferencesSettingsTab";
import VoiceSettingsTab from "../settings/tabs/VoiceSettingsTab";
import HelpSettingsTab from "../settings/tabs/HelpSettingsTab";
import FlairSettingsTab from "../settings/tabs/FlairSettingsTab";
import sdk from "../../../index";

// TODO: Ditch this whole component
export class TempTab extends React.Component {
    static propTypes = {
        onClose: PropTypes.func.isRequired,
    };

    componentDidMount(): void {
        dis.dispatch({action: "view_old_user_settings"});
        this.props.onClose();
    }

    render() {
        return <div>Hello World</div>;
    }
}

export default class UserSettingsDialog extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    _getTabs() {
        const tabs = [];

        tabs.push(new Tab(
            _td("General"),
            "mx_UserSettingsDialog_settingsIcon",
            <GeneralUserSettingsTab />,
        ));
        tabs.push(new Tab(
            _td("Flair"),
            "mx_UserSettingsDialog_flairIcon",
            <FlairSettingsTab />,
        ));
        tabs.push(new Tab(
            _td("Notifications"),
            "mx_UserSettingsDialog_bellIcon",
            <NotificationSettingsTab />,
        ));
        tabs.push(new Tab(
            _td("Preferences"),
            "mx_UserSettingsDialog_preferencesIcon",
            <PreferencesSettingsTab />,
        ));
        tabs.push(new Tab(
            _td("Voice & Video"),
            "mx_UserSettingsDialog_voiceIcon",
            <VoiceSettingsTab />,
        ));
        tabs.push(new Tab(
            _td("Security & Privacy"),
            "mx_UserSettingsDialog_securityIcon",
            <SecuritySettingsTab />,
        ));
        if (SettingsStore.getLabsFeatures().length > 0) {
            tabs.push(new Tab(
                _td("Labs"),
                "mx_UserSettingsDialog_labsIcon",
                <LabsSettingsTab />,
            ));
        }
        tabs.push(new Tab(
            _td("Help & About"),
            "mx_UserSettingsDialog_helpIcon",
            <HelpSettingsTab closeSettingsFn={this.props.onFinished} />,
        ));
        // tabs.push(new Tab(
        //     _td("Visit old settings"),
        //     "mx_UserSettingsDialog_helpIcon",
        //     <TempTab onClose={this.props.onFinished} />,
        // ));

        return tabs;
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        return (
            <BaseDialog className='mx_UserSettingsDialog' hasCancel={true}
                        onFinished={this.props.onFinished} title={_t("Settings")}>
                <div className='ms_SettingsDialog_content'>
                    <TabbedView tabs={this._getTabs()} />
                </div>
            </BaseDialog>
        );
    }
}
