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

import React, {createRef} from 'react';
import {_t} from "../../../languageHandler";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import Field from "../elements/Field";
import { getHostingLink } from '../../../utils/HostingLink';
import * as sdk from "../../../index";
import {OwnProfileStore} from "../../../stores/OwnProfileStore";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";

export default class ProfileSettings extends React.Component {
    constructor() {
        super();

        const client = MatrixClientPeg.get();
        let avatarUrl = OwnProfileStore.instance.avatarMxc;
        if (avatarUrl) avatarUrl = client.mxcUrlToHttp(avatarUrl, 96, 96, 'crop', false);
        this.state = {
            userId: client.getUserId(),
            originalDisplayName: OwnProfileStore.instance.displayName,
            displayName: OwnProfileStore.instance.displayName,
            originalAvatarUrl: avatarUrl,
            avatarUrl: avatarUrl,
            avatarFile: null,
            enableProfileSave: false,
        };

        this._avatarUpload = createRef();
    }

    _uploadAvatar = () => {
        this._avatarUpload.current.click();
    };

    _removeAvatar = () => {
        // clear file upload field so same file can be selected
        this._avatarUpload.current.value = "";
        this.setState({
            avatarUrl: null,
            avatarFile: null,
            enableProfileSave: true,
        });
    };

    _cancelProfileChanges = async (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.enableProfileSave) return;
        this.setState({
            enableProfileSave: false,
            displayName: this.state.originalDisplayName,
            avatarUrl: this.state.originalAvatarUrl,
            avatarFile: null,
        });
    };

    _saveProfile = async (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.enableProfileSave) return;
        this.setState({enableProfileSave: false});

        const client = MatrixClientPeg.get();
        const newState = {};

        const displayName = this.state.displayName.trim();
        try {
            if (this.state.originalDisplayName !== this.state.displayName) {
                await client.setDisplayName(displayName);
                newState.originalDisplayName = displayName;
                newState.displayName = displayName;
            }

            if (this.state.avatarFile) {
                console.log(
                    `Uploading new avatar, ${this.state.avatarFile.name} of type ${this.state.avatarFile.type},` +
                    ` (${this.state.avatarFile.size}) bytes`);
                const uri = await client.uploadContent(this.state.avatarFile);
                await client.setAvatarUrl(uri);
                newState.avatarUrl = client.mxcUrlToHttp(uri, 96, 96, 'crop', false);
                newState.originalAvatarUrl = newState.avatarUrl;
                newState.avatarFile = null;
            } else if (this.state.originalAvatarUrl !== this.state.avatarUrl) {
                await client.setAvatarUrl(""); // use empty string as Synapse 500s on undefined
            }
        } catch (err) {
            console.log("Failed to save profile", err);
            Modal.createTrackedDialog('Failed to save profile', '', ErrorDialog, {
                title: _t("Failed to save your profile"),
                description: ((err && err.message) ? err.message : _t("The operation could not be completed")),
            });
        }

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

    render() {
        const hostingSignupLink = getHostingLink('user-settings');
        let hostingSignup = null;
        if (hostingSignupLink) {
            hostingSignup = <span className="mx_ProfileSettings_hostingSignup">
                {_t(
                    "<a>Upgrade</a> to your own domain", {},
                    {
                        a: sub => <a href={hostingSignupLink} target="_blank" rel="noreferrer noopener">{sub}</a>,
                    },
                )}
                <a href={hostingSignupLink} target="_blank" rel="noreferrer noopener">
                    <img src={require("../../../../res/img/external-link.svg")} width="11" height="10" alt='' />
                </a>
            </span>;
        }

        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const AvatarSetting = sdk.getComponent('settings.AvatarSetting');
        return (
            <form
                onSubmit={this._saveProfile}
                autoComplete="off"
                noValidate={true}
                className="mx_ProfileSettings_profileForm"
            >
                <input type="file" ref={this._avatarUpload} className="mx_ProfileSettings_avatarUpload"
                       onChange={this._onAvatarChanged} accept="image/*" />
                <div className="mx_ProfileSettings_profile">
                    <div className="mx_ProfileSettings_controls">
                        <span className="mx_SettingsTab_subheading">{_t("Profile")}</span>
                        <Field
                            label={_t("Display Name")}
                            type="text" value={this.state.displayName}
                            autoComplete="off"
                            onChange={this._onDisplayNameChanged}
                        />
                        <p>
                            {this.state.userId}
                            {hostingSignup}
                        </p>
                    </div>
                    <AvatarSetting
                        avatarUrl={this.state.avatarUrl}
                        avatarName={this.state.displayName || this.state.userId}
                        avatarAltText={_t("Profile picture")}
                        uploadAvatar={this._uploadAvatar}
                        removeAvatar={this._removeAvatar} />
                </div>
                <div className="mx_ProfileSettings_buttons">
                    <AccessibleButton
                        onClick={this._cancelProfileChanges}
                        kind="link"
                        disabled={!this.state.enableProfileSave}
                    >
                        {_t("Cancel")}
                    </AccessibleButton>
                    <AccessibleButton
                        onClick={this._saveProfile}
                        kind="primary"
                        disabled={!this.state.enableProfileSave}
                    >
                        {_t("Save")}
                    </AccessibleButton>
                </div>
            </form>
        );
    }
}
