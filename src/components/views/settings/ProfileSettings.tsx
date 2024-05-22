/*
Copyright 2019 - 2024 The Matrix.org Foundation C.I.C.

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

import React, { createRef } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Field from "../elements/Field";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import AvatarSetting from "./AvatarSetting";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import PosthogTrackers from "../../../PosthogTrackers";
import { SettingsSubsectionHeading } from "./shared/SettingsSubsectionHeading";

interface IState {
    originalDisplayName: string;
    displayName: string;
    originalAvatarUrl: string | null;
    avatarFile?: File | null;
    // If true, the user has indicated that they wish to remove the avatar and this should happen on save.
    avatarRemovalPending: boolean;
    enableProfileSave?: boolean;
}

export default class ProfileSettings extends React.Component<{}, IState> {
    private readonly userId: string;
    private avatarUpload: React.RefObject<HTMLInputElement> = createRef();

    public constructor(props: {}) {
        super(props);

        this.userId = MatrixClientPeg.safeGet().getSafeUserId();
        const avatarUrl = OwnProfileStore.instance.avatarMxc;
        this.state = {
            originalDisplayName: OwnProfileStore.instance.displayName ?? "",
            displayName: OwnProfileStore.instance.displayName ?? "",
            originalAvatarUrl: avatarUrl,
            avatarFile: null,
            avatarRemovalPending: false,
            enableProfileSave: false,
        };
    }

    private onChange = (file: File): void => {
        PosthogTrackers.trackInteraction("WebProfileSettingsAvatarUploadButton");
        this.setState({
            avatarFile: file,
            avatarRemovalPending: false,
            enableProfileSave: true,
        });
    };

    private removeAvatar = (): void => {
        // clear file upload field so same file can be selected
        if (this.avatarUpload.current) {
            this.avatarUpload.current.value = "";
        }
        this.setState({
            avatarFile: null,
            avatarRemovalPending: true,
            enableProfileSave: true,
        });
    };

    private cancelProfileChanges = async (e: ButtonEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.enableProfileSave) return;
        this.setState({
            enableProfileSave: false,
            displayName: this.state.originalDisplayName,
            avatarFile: null,
            avatarRemovalPending: false,
        });
    };

    private saveProfile = async (e: ButtonEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.enableProfileSave) return;
        this.setState({ enableProfileSave: false });

        const newState: Partial<IState> = {};

        const displayName = this.state.displayName.trim();
        try {
            const client = MatrixClientPeg.safeGet();
            if (this.state.originalDisplayName !== this.state.displayName) {
                await client.setDisplayName(displayName);
                newState.originalDisplayName = displayName;
                newState.displayName = displayName;
            }

            if (this.state.avatarFile) {
                logger.log(
                    `Uploading new avatar, ${this.state.avatarFile.name} of type ${this.state.avatarFile.type},` +
                        ` (${this.state.avatarFile.size}) bytes`,
                );
                const { content_uri: uri } = await client.uploadContent(this.state.avatarFile);
                await client.setAvatarUrl(uri);
                newState.originalAvatarUrl = uri;
                newState.avatarFile = null;
            } else if (this.state.avatarRemovalPending) {
                await client.setAvatarUrl(""); // use empty string as Synapse 500s on undefined
                newState.originalAvatarUrl = null;
                newState.avatarRemovalPending = false;
            }
        } catch (err) {
            logger.log("Failed to save profile", err);
            Modal.createDialog(ErrorDialog, {
                title: _t("settings|general|error_saving_profile_title"),
                description: err instanceof Error ? err.message : _t("settings|general|error_saving_profile"),
            });
        }

        this.setState<any>(newState);
    };

    private onDisplayNameChanged = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            displayName: e.target.value,
            enableProfileSave: true,
        });
    };

    public render(): React.ReactNode {
        const userIdentifier = UserIdentifierCustomisations.getDisplayUserIdentifier(this.userId, {
            withDisplayName: true,
        });

        return (
            <form onSubmit={this.saveProfile} autoComplete="off" noValidate={true} className="mx_ProfileSettings">
                <div className="mx_ProfileSettings_profile">
                    <div className="mx_ProfileSettings_profile_controls">
                        <SettingsSubsectionHeading heading={_t("common|profile")} />
                        <Field
                            label={_t("common|display_name")}
                            type="text"
                            value={this.state.displayName}
                            autoComplete="off"
                            onChange={this.onDisplayNameChanged}
                        />
                        <p>
                            {userIdentifier && (
                                <span className="mx_ProfileSettings_profile_controls_userId">{userIdentifier}</span>
                            )}
                        </p>
                    </div>
                    <AvatarSetting
                        avatar={
                            this.state.avatarRemovalPending
                                ? undefined
                                : this.state.avatarFile ?? this.state.originalAvatarUrl ?? undefined
                        }
                        avatarAltText={_t("common|user_avatar")}
                        onChange={this.onChange}
                        removeAvatar={this.removeAvatar}
                    />
                </div>
                <div className="mx_ProfileSettings_buttons">
                    <AccessibleButton
                        onClick={this.cancelProfileChanges}
                        kind="primary_outline"
                        disabled={!this.state.enableProfileSave}
                    >
                        {_t("action|cancel")}
                    </AccessibleButton>
                    <AccessibleButton
                        onClick={this.saveProfile}
                        kind="primary"
                        disabled={!this.state.enableProfileSave}
                    >
                        {_t("action|save")}
                    </AccessibleButton>
                </div>
            </form>
        );
    }
}
