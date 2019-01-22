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
import AccessibleButton from "../elements/AccessibleButton";
import GeneralSettingsTab from "../settings/tabs/GeneralSettingsTab";
import dis from '../../../dispatcher';

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
        return [
            new Tab(
                _td("General"),
                "mx_UserSettingsDialog_settingsIcon",
                <GeneralSettingsTab />,
            ),
            new Tab(
                _td("Notifications"),
                "mx_UserSettingsDialog_bellIcon",
                <div>Notifications Test</div>,
            ),
            new Tab(
                _td("Preferences"),
                "mx_UserSettingsDialog_preferencesIcon",
                <div>Preferences Test</div>,
            ),
            new Tab(
                _td("Voice & Video"),
                "mx_UserSettingsDialog_voiceIcon",
                <div>Voice Test</div>,
            ),
            new Tab(
                _td("Security & Privacy"),
                "mx_UserSettingsDialog_securityIcon",
                <div>Security Test</div>,
            ),
            new Tab(
                _td("Help & About"),
                "mx_UserSettingsDialog_helpIcon",
                <div>Help Test</div>,
            ),
            new Tab(
                _td("Visit old settings"),
                "mx_UserSettingsDialog_helpIcon",
                <TempTab onClose={this.props.onFinished} />,
            ),
        ];
    }

    render() {
        return (
            <div className="mx_UserSettingsDialog">
                <div className="mx_UserSettingsDialog_header">
                    {_t("Settings")}
                    <span className="mx_UserSettingsDialog_close">
                        <AccessibleButton className="mx_UserSettingsDialog_closeIcon" onClick={this.props.onFinished} />
                    </span>
                </div>
                <TabbedView tabs={this._getTabs()} />
            </div>
        );
    }
}
