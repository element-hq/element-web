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
import classNames from 'classnames';

export default class GeneralSettingsTab extends React.Component {
    constructor() {
        super();

        const client = MatrixClientPeg.get();
        const user = client.getUser(client.getUserId());
        let avatarUrl = user.avatarUrl;
        if (avatarUrl) avatarUrl = client.mxcUrlToHttp(avatarUrl, 96, 96, 'crop', false);
        this.state = {
            userId: user.userId,
            originalDisplayName: user.displayName,
            displayName: user.displayName,
            originalAvatarUrl: avatarUrl,
            avatarUrl: avatarUrl,
            avatarFile: null,
            enableProfileSave: false,
        };
    }

    _uploadAvatar = (e) => {
        e.stopPropagation();
        e.preventDefault();

        this.refs.avatarUpload.click();
    };

    _saveProfile = async (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.enableProfileSave) return;
        this.setState({enableProfileSave: false});

        const client = MatrixClientPeg.get();
        const newState = {};

        // TODO: What do we do about errors?

        if (this.state.originalDisplayName !== this.state.displayName) {
            await client.setDisplayName(this.state.displayName);
            newState.originalDisplayName = this.state.displayName;
        }

        if (this.state.avatarFile) {
            const uri = await client.uploadContent(this.state.avatarFile);
            await client.setAvatarUrl(uri);
            newState.avatarUrl = client.mxcUrlToHttp(uri, 96, 96, 'crop', false);
            newState.originalAvatarUrl = newState.avatarUrl;
            newState.avatarFile = null;
        }

        newState.enableProfileSave = true;
        this.setState(newState);
    };

    _onDisplayNameChanged = (e) => {
        this.setState({
            displayName: e.target.value,
            enableProfileSave: true,
        });
    };

    _onAvatarChanged = (e) => {
        if (!e.target.files || !e.target.files.length) {
            this.setState({
                avatarUrl: this.state.originalAvatarUrl,
                avatarFile: null,
                enableProfileSave: false,
            });
            return;
        }

        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            this.setState({
                avatarUrl: ev.target.result,
                avatarFile: file,
                enableProfileSave: true,
            });
        };
        reader.readAsDataURL(file);
    };

    _renderProfileSection() {
        // TODO: Why is rendering a box with an overlay so complicated? Can the DOM be reduced?

        let showOverlayAnyways = true;
        let avatarElement = <div className="mx_GeneralSettingsTab_profileAvatarPlaceholder" />;
        if (this.state.avatarUrl) {
            showOverlayAnyways = false;
            avatarElement = <img src={this.state.avatarUrl} className="mx_GeneralSettingsTab_profileAvatarImg"
                                 alt={_t("Profile picture")}/>
        }

        const avatarOverlayClasses = classNames({
            "mx_GeneralSettingsTab_profileAvatarOverlay": true,
            "mx_GeneralSettingsTab_profileAvatarOverlay_show": showOverlayAnyways,
        });
        let avatarHoverElement = (
            <div className={avatarOverlayClasses} onClick={this._uploadAvatar}>
                <span className="mx_GeneralSettingsTab_profileAvatarOverlayText">{_t("Upload profile picture")}</span>
                <div className="mx_GeneralSettingsTab_profileAvatarOverlayImgContainer">
                    <div className="mx_GeneralSettingsTab_profileAvatarOverlayImg" />
                </div>
            </div>
        );

        const form = (
            <form onSubmit={this._saveProfile} autoComplete={false} noValidate={true}>
                <input type="file" ref="avatarUpload" className="mx_GeneralSettingsTab_profileAvatarUpload"
                       onChange={this._onAvatarChanged} accept="image/*" />
                <div className="mx_GeneralSettingsTab_profile">
                    <div className="mx_GeneralSettingsTab_profileControls">
                        <p className="mx_GeneralSettingsTab_profileUsername">{this.state.userId}</p>
                        <Field id="profileDisplayName" label={_t("Display Name")}
                               type="text" value={this.state.displayName} autoComplete="off"
                               onChange={this._onDisplayNameChanged} />
                    </div>
                    <div className="mx_GeneralSettingsTab_profileAvatar">
                        {avatarElement}
                        {avatarHoverElement}
                    </div>
                </div>
                <AccessibleButton onClick={this._saveProfile} kind="primary"
                                  disabled={!this.state.enableProfileSave}>
                    {_t("Save")}
                </AccessibleButton>
                <div>FLAIR</div>
            </form>
        );

        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Profile")}</span>
                {form}
            </div>
        );
    }

    _renderAccountSection() {
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Account")}</span>
                <p>ACCOUNT SECTION</p>
            </div>
        );
    }

    _renderLanguageSection() {
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Language and region")}</span>
                <p>LANGUAGE SECTION</p>
            </div>
        );
    }

    _renderThemeSection() {
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Theme")}</span>
                <p>THEME SECTION</p>
            </div>
        );
    }

    _renderManagementSection() {
        return (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Account management")}</span>
                <p>MANAGEMENT SECTION</p>
            </div>
        );
    }

    render() {
        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("General")}</div>
                {this._renderProfileSection()}
                {this._renderAccountSection()}
                {this._renderLanguageSection()}
                {this._renderThemeSection()}
                {this._renderManagementSection()}
            </div>
        );
    }
}
