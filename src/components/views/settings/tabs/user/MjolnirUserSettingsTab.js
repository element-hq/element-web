/*
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
import {_t} from "../../../../../languageHandler";
const sdk = require("../../../../..");

export default class MjolnirUserSettingsTab extends React.Component {
    constructor() {
        super();
    }

    render() {
        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Ignored users")}</div>
                <div className="mx_SettingsTab_section">
                    <div className='mx_SettingsTab_subsectionText'>
                        <span className='warning'>{_t("⚠ These settings are meant for advanced users.")}</span><br />
                        <br />
                        {_t(
                            "Add users and servers you want to ignore here. Use asterisks " +
                            "to have Riot match any characters. For example, <code>@bot:*</code> " +
                            "would ignore all users that have the name 'bot' on any server.",
                            {}, {code: (s) => <code>{s}</code>},
                        )}<br />
                        <br />
                        {_t(
                            "Ignoring people is done through ban lists which contain rules for " +
                            "who to ban. Subscribing to a ban list means the users/servers blocked by " +
                            "that list will be hidden from you."
                        )}
                    </div>
                </div>
                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Personal ban list")}</span>
                    <div className='mx_SettingsTab_subsectionText'>
                        {_t(
                            "Your personal ban list holds all the users/servers you personally don't " +
                            "want to see messages from. After ignoring your first user/server, a new room " +
                            "will show up in your room list named 'My Ban List' - stay in this room to keep " +
                            "the ban list in effect.",
                        )}
                    </div>
                    <p>TODO</p>
                </div>
                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Subscribed lists")}</span>
                    <div className='mx_SettingsTab_subsectionText'>
                        <span className='warning'>{_t("Subscribing to a ban list will cause you to join it!")}</span>
                        &nbsp;
                        <span>{_t(
                            "If this isn't what you want, please use a different tool to ignore users.",
                        )}</span>
                    </div>
                    <p>TODO</p>
                </div>
            </div>
        );
    }
}
