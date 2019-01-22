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
import Field from "../../elements/Field";
import AccessibleButton from "../../elements/AccessibleButton";

export default class GeneralSettingsTab extends React.Component {

    constructor() {
        super();

        const client = MatrixClientPeg.get();
        this.state = {
            userId: client.getUserId(),
            displayName: client.getUser(client.getUserId()).displayName,
            enableProfileSave: false,
        };
    }

    _saveProfile = async (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.enableProfileSave) return;
        this.setState({enableProfileSave: false});

        // TODO: What do we do about errors?
        await MatrixClientPeg.get().setDisplayName(this.state.displayName);

        // TODO: Support avatars

        this.setState({enableProfileSave: true});
    };

    _onDisplayNameChanged = (e) => {
        this.setState({
            displayName: e.target.value,
            enableProfileSave: true,
        });
    };

    _renderProfileSection() {
        const form = (
            <form onSubmit={this._saveProfile} autoComplete={false} noValidate={true}>
                <div className="mx_GeneralSettingsTab_profile">
                    <div className="mx_GeneralSettingsTab_profileControls">
                        <p className="mx_GeneralSettingsTab_profileUsername">{this.state.userId}</p>
                        <Field id="profileDisplayName" label={_t("Display Name")}
                               type="text" value={this.state.displayName} autocomplete="off"
                               onChange={this._onDisplayNameChanged}
                        />
                    </div>
                    <div className="mx_GeneralSettingsTab_profileAvatar">
                        {/*TODO: Ditch avatar placeholder and use the real thing*/}
                        <div/>
                    </div>
                </div>
                <AccessibleButton onClick={this._saveProfile} kind="primary"
                                  disabled={!this.state.enableProfileSave}
                >
                    {_t("Save")}
                </AccessibleButton>
            </form>
        );

        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Profile")}</span>
                {form}
            </div>
        );
    }

    render() {
        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("General")}</div>
                {this._renderProfileSection()}
            </div>
        );
    }
}
