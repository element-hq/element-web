/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

import React, { createRef } from 'react';
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Field from "../elements/Field";
import { getHostingLink } from '../../../utils/HostingLink';
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { mediaFromMxc } from "../../../customisations/Media";
import AccessibleButton from '../elements/AccessibleButton';
import AvatarSetting from './AvatarSetting';

import { logger } from "matrix-js-sdk/src/logger";

interface IState {
    userId?: string;
    originalDisplayName?: string;
    displayName?: string;
    originalAvatarUrl?: string;
    avatarUrl?: string | ArrayBuffer;
    avatarFile?: File;
    enableProfileSave?: boolean;
}

@replaceableComponent("views.settings.ProfileSettings")
export default class ProfileSettings extends React.Component<{}, IState> {
    private avatarUpload: React.RefObject<HTMLInputElement> = createRef();

    constructor(props: {}) {
        super(props);

        const client = MatrixClientPeg.get();
        let avatarUrl = OwnProfileStore.instance.avatarMxc;
        if (avatarUrl) avatarUrl = mediaFromMxc(avatarUrl).getSquareThumbnailHttp(96);
        this.state = {
            userId: client.getUserId(),
            originalDisplayName: OwnProfileStore.instance.displayName,
            displayName: OwnProfileStore.instance.displayName,
            originalAvatarUrl: avatarUrl,
            avatarUrl: avatarUrl,
            avatarFile: null,
            enableProfileSave: false,
        };
    }

    private uploadAvatar = (): void => {
        this.avatarUpload.current.click();
    };

    private removeAvatar = (): void => {
        // clear file upload field so same file can be selected
        this.avatarUpload.current.value = "";
        this.setState({
            avatarUrl: null,
            avatarFile: null,
            enableProfileSave: true,
        });
    };

    private cancelProfileChanges = async (e: React.MouseEvent): Promise<void> => {
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

    private saveProfile = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.enableProfileSave) return;
        this.setState({ enableProfileSave: false });

        const client = MatrixClientPeg.get();
        const newState: IState = {};

        const displayName = this.state.displayName.trim();
        try {
            if (this.state.originalDisplayName !== this.state.displayName) {
                await client.setDisplayName(displayName);
                newState.originalDisplayName = displayName;
                newState.displayName = displayName;
            }

            if (this.state.avatarFile) {
                logger.log(
                    `Uploading new avatar, ${this.state.avatarFile.name} of type ${this.state.avatarFile.type},` +
                    ` (${this.state.avatarFile.size}) bytes`);
                const uri = await client.uploadContent(this.state.avatarFile);
                await client.setAvatarUrl(uri);
                newState.avatarUrl = mediaFromMxc(uri).getSquareThumbnailHttp(96);
                newState.originalAvatarUrl = newState.avatarUrl;
                newState.avatarFile = null;
            } else if (this.state.originalAvatarUrl !== this.state.avatarUrl) {
                await client.setAvatarUrl(""); // use empty string as Synapse 500s on undefined
            }
        } catch (err) {
            logger.log("Failed to save profile", err);
            Modal.createTrackedDialog('Failed to save profile', '', ErrorDialog, {
                title: _t("Failed to save your profile"),
                description: ((err && err.message) ? err.message : _t("The operation could not be completed")),
            });
        }

        this.setState(newState);
    };

    private onDisplayNameChanged = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            displayName: e.target.value,
            enableProfileSave: true,
        });
    };

    private onAvatarChanged = (e: React.ChangeEvent<HTMLInputElement>): void => {
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

    public render(): JSX.Element {
        const hostingSignupLink = getHostingLink('user-settings');
        let hostingSignup = null;
        if (hostingSignupLink) {
            hostingSignup = <span className="mx_ProfileSettings_hostingSignup">
                { _t(
                    "<a>Upgrade</a> to your own domain", {},
                    {
                        a: sub => <a href={hostingSignupLink} target="_blank" rel="noreferrer noopener">{ sub }</a>,
                    },
                ) }
                <a href={hostingSignupLink} target="_blank" rel="noreferrer noopener">
                    <img src={require("../../../../res/img/external-link.svg")} width="11" height="10" alt='' />
                </a>
            </span>;
        }

        return (
            <form
                onSubmit={this.saveProfile}
                autoComplete="off"
                noValidate={true}
                className="mx_ProfileSettings_profileForm"
            >
                <input
                    type="file"
                    ref={this.avatarUpload}
                    className="mx_ProfileSettings_avatarUpload"
                    onChange={this.onAvatarChanged}
                    accept="image/*"
                />
                <div className="mx_ProfileSettings_profile">
                    <div className="mx_ProfileSettings_controls">
                        <span className="mx_SettingsTab_subheading">{ _t("Profile") }</span>
                        <Field
                            label={_t("Display Name")}
                            type="text"
                            value={this.state.displayName}
                            autoComplete="off"
                            onChange={this.onDisplayNameChanged}
                        />
                        <p>
                            { this.state.userId }
                            { hostingSignup }
                        </p>
                    </div>
                    <AvatarSetting
                        avatarUrl={this.state.avatarUrl?.toString()}
                        avatarName={this.state.displayName || this.state.userId}
                        avatarAltText={_t("Profile picture")}
                        uploadAvatar={this.uploadAvatar}
                        removeAvatar={this.removeAvatar} />
                </div>
                <div className="mx_ProfileSettings_buttons">
                    <AccessibleButton
                        onClick={this.cancelProfileChanges}
                        kind="link"
                        disabled={!this.state.enableProfileSave}
                    >
                        { _t("Cancel") }
                    </AccessibleButton>
                    <AccessibleButton
                        onClick={this.saveProfile}
                        kind="primary"
                        disabled={!this.state.enableProfileSave}
                    >
                        { _t("Save") }
                    </AccessibleButton>
                </div>
            </form>
        );
    }
}
