/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React, { ChangeEvent } from 'react';
import BaseDialog from "./BaseDialog";
import { _t } from "../../../languageHandler";
import { IDialogProps } from "./IDialogProps";
import Field from "../elements/Field";
import AccessibleButton from "../elements/AccessibleButton";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { CommunityPrototypeStore } from "../../../stores/CommunityPrototypeStore";
import FlairStore from "../../../stores/FlairStore";

interface IProps extends IDialogProps {
    communityId: string;
}

interface IState {
    name: string;
    error: string;
    busy: boolean;
    currentAvatarUrl: string;
    avatarFile: File;
    avatarPreview: string;
}

// XXX: This is a lot of duplication from the create dialog, just in a different shape
export default class EditCommunityPrototypeDialog extends React.PureComponent<IProps, IState> {
    private avatarUploadRef: React.RefObject<HTMLInputElement> = React.createRef();

    constructor(props: IProps) {
        super(props);

        const profile = CommunityPrototypeStore.instance.getCommunityProfile(props.communityId);

        this.state = {
            name: profile?.name || "",
            error: null,
            busy: false,
            avatarFile: null,
            avatarPreview: null,
            currentAvatarUrl: profile?.avatarUrl,
        };
    }

    private onNameChange = (ev: ChangeEvent<HTMLInputElement>) => {
        this.setState({name: ev.target.value});
    };

    private onSubmit = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (this.state.busy) return;

        // We'll create the community now to see if it's taken, leaving it active in
        // the background for the user to look at while they invite people.
        this.setState({busy: true});
        try {
            let avatarUrl = this.state.currentAvatarUrl || ""; // must be a string for synapse to accept it
            if (this.state.avatarFile) {
                avatarUrl = await MatrixClientPeg.get().uploadContent(this.state.avatarFile);
            }

            await MatrixClientPeg.get().setGroupProfile(this.props.communityId, {
                name: this.state.name,
                avatar_url: avatarUrl,
            });

            // ask the flair store to update the profile too
            await FlairStore.refreshGroupProfile(MatrixClientPeg.get(), this.props.communityId);

            // we did it, so close the dialog
            this.props.onFinished(true);
        } catch (e) {
            console.error(e);
            this.setState({
                busy: false,
                error: _t("There was an error updating your community. The server is unable to process your request."),
            });
        }
    };

    private onAvatarChanged = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files.length) {
            this.setState({avatarFile: null});
        } else {
            this.setState({busy: true});
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev: ProgressEvent<FileReader>) => {
                this.setState({avatarFile: file, busy: false, avatarPreview: ev.target.result as string});
            };
            reader.readAsDataURL(file);
        }
    };

    private onChangeAvatar = () => {
        if (this.avatarUploadRef.current) this.avatarUploadRef.current.click();
    };

    public render() {
        let preview = <img src={this.state.avatarPreview} className="mx_EditCommunityPrototypeDialog_avatar" />;
        if (!this.state.avatarPreview) {
            if (this.state.currentAvatarUrl) {
                const url = MatrixClientPeg.get().mxcUrlToHttp(this.state.currentAvatarUrl);
                preview = <img src={url} className="mx_EditCommunityPrototypeDialog_avatar" />;
            } else {
                preview = <div className="mx_EditCommunityPrototypeDialog_placeholderAvatar" />
            }
        }

        return (
            <BaseDialog
                className="mx_EditCommunityPrototypeDialog"
                onFinished={this.props.onFinished}
                title={_t("Update community")}
            >
                <form onSubmit={this.onSubmit}>
                    <div className="mx_Dialog_content">
                        <div className="mx_EditCommunityPrototypeDialog_rowName">
                            <Field
                                value={this.state.name}
                                onChange={this.onNameChange}
                                placeholder={_t("Enter name")}
                                label={_t("Enter name")}
                            />
                        </div>
                        <div className="mx_EditCommunityPrototypeDialog_rowAvatar">
                            <input
                                type="file" style={{display: "none"}}
                                ref={this.avatarUploadRef} accept="image/*"
                                onChange={this.onAvatarChanged}
                            />
                            <AccessibleButton
                                onClick={this.onChangeAvatar}
                                className="mx_EditCommunityPrototypeDialog_avatarContainer"
                            >{preview}</AccessibleButton>
                            <div className="mx_EditCommunityPrototypeDialog_tip">
                                <b>{_t("Add image (optional)")}</b>
                                <span>
                                    {_t("An image will help people identify your community.")}
                                </span>
                            </div>
                        </div>
                        <AccessibleButton kind="primary" onClick={this.onSubmit} disabled={this.state.busy}>
                            {_t("Save")}
                        </AccessibleButton>
                    </div>
                </form>
            </BaseDialog>
        );
    }
}
