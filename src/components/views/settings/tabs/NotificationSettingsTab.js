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
import {_t} from "../../../../languageHandler";
import MatrixClientPeg from "../../../../MatrixClientPeg";
const sdk = require("../../../../index");

export default class NotificationSettingsTab extends React.Component {
    constructor() {
        super();

        this.state = {
            threepids: [],
        };
    }

    async componentWillMount(): void {
        MatrixClientPeg.get().getThreePids().then(r => this.setState({threepids: r.threepids}));
    }

    render() {
        const Notifications = sdk.getComponent("views.settings.Notifications");
        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Notifications")}</div>
                <div className="mx_SettingsTab_section">
                    <Notifications threepids={this.state.threepids} />
                </div>
            </div>
        );
    }
}