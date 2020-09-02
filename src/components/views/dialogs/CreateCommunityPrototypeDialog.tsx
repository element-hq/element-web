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
import InfoTooltip from "../elements/InfoTooltip";
import dis from "../../../dispatcher/dispatcher";
import {showCommunityRoomInviteDialog} from "../../../RoomInvite";
import GroupStore from "../../../stores/GroupStore";

interface IProps extends IDialogProps {
}

interface IState {
    name: string;
    localpart: string;
    error: string;
    busy: boolean;
    avatarFile: File;
    avatarPreview: string;
}

export default class CreateCommunityPrototypeDialog extends React.PureComponent<IProps, IState> {
    private avatarUploadRef: React.RefObject<HTMLInputElement> = React.createRef();

    constructor(props: IProps) {
        super(props);

        this.state = {
            name: "",
            localpart: "",
            error: null,
            busy: false,
            avatarFile: null,
            avatarPreview: null,
        };
    }

    private onNameChange = (ev: ChangeEvent<HTMLInputElement>) => {
        const localpart = (ev.target.value || "").toLowerCase().replace(/[^a-z0-9.\-_]/g, '-');
        this.setState({name: ev.target.value, localpart});
    };

    private onSubmit = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (this.state.busy) return;

        // We'll create the community now to see if it's taken, leaving it active in
        // the background for the user to look at while they invite people.
        this.setState({busy: true});
        try {
            let avatarUrl = ''; // must be a string for synapse to accept it
            if (this.state.avatarFile) {
                avatarUrl = await MatrixClientPeg.get().uploadContent(this.state.avatarFile);
            }

            const result = await MatrixClientPeg.get().createGroup({
                localpart: this.state.localpart,
                profile: {
                    name: this.state.name,
                    avatar_url: avatarUrl,
                },
            });

            // Ensure the tag gets selected now that we've created it
            dis.dispatch({action: 'deselect_tags'}, true);
            dis.dispatch({
                action: 'select_tag',
                tag: result.group_id,
            });

            // Close our own dialog before moving much further
            this.props.onFinished(true);

            if (result.room_id) {
                // Force the group store to update as it might have missed the general chat
                await GroupStore.refreshGroupRooms(result.group_id);
                dis.dispatch({
                    action: 'view_room',
                    room_id: result.room_id,
                });
                showCommunityRoomInviteDialog(result.room_id, this.state.name);
            } else {
                dis.dispatch({
                    action: 'view_group',
                    group_id: result.group_id,
                    group_is_new: true,
                });
            }
        } catch (e) {
            console.error(e);
            this.setState({
                busy: false,
                error: _t(
                    "There was an error creating your community. The name may be taken or the " +
                    "server is unable to process your request.",
                ),
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
        let communityId = null;
        if (this.state.localpart) {
            communityId = (
                <span className="mx_CreateCommunityPrototypeDialog_communityId">
                    {_t("Community ID: +<localpart />:%(domain)s", {
                        domain: MatrixClientPeg.getHomeserverName(),
                    }, {
                        localpart: () => <u>{this.state.localpart}</u>,
                    })}
                    <InfoTooltip
                        tooltip={_t(
                            "Use this when referencing your community to others. The community ID " +
                            "cannot be changed.",
                        )}
                    />
                </span>
            );
        }

        let helpText = (
            <span className="mx_CreateCommunityPrototypeDialog_subtext">
                {_t("You can change this later if needed.")}
            </span>
        );
        if (this.state.error) {
            const classes = "mx_CreateCommunityPrototypeDialog_subtext mx_CreateCommunityPrototypeDialog_subtext_error";
            helpText = (
                <span className={classes}>
                    {this.state.error}
                </span>
            );
        }

        let preview = <img src={this.state.avatarPreview} className="mx_CreateCommunityPrototypeDialog_avatar" />;
        if (!this.state.avatarPreview) {
            preview = <div className="mx_CreateCommunityPrototypeDialog_placeholderAvatar" />
        }

        return (
            <BaseDialog
                className="mx_CreateCommunityPrototypeDialog"
                onFinished={this.props.onFinished}
                title={_t("What's the name of your community or team?")}
            >
                <form onSubmit={this.onSubmit}>
                    <div className="mx_Dialog_content">
                        <div className="mx_CreateCommunityPrototypeDialog_colName">
                            <Field
                                value={this.state.name}
                                onChange={this.onNameChange}
                                placeholder={_t("Enter name")}
                                label={_t("Enter name")}
                            />
                            {helpText}
                            <span className="mx_CreateCommunityPrototypeDialog_subtext">
                                {/*nbsp is to reserve the height of this element when there's nothing*/}
                                &nbsp;{communityId}
                            </span>
                            <AccessibleButton kind="primary" onClick={this.onSubmit} disabled={this.state.busy}>
                                {_t("Create")}
                            </AccessibleButton>
                        </div>
                        <div className="mx_CreateCommunityPrototypeDialog_colAvatar">
                            <input
                                type="file" style={{display: "none"}}
                                ref={this.avatarUploadRef} accept="image/*"
                                onChange={this.onAvatarChanged}
                            />
                            <AccessibleButton
                                onClick={this.onChangeAvatar}
                                className="mx_CreateCommunityPrototypeDialog_avatarContainer"
                            >
                                {preview}
                            </AccessibleButton>
                            <div className="mx_CreateCommunityPrototypeDialog_tip">
                                <b>{_t("Add image (optional)")}</b>
                                <span>
                                    {_t("An image will help people identify your community.")}
                                </span>
                            </div>
                        </div>
                    </div>
                </form>
            </BaseDialog>
        );
    }
}
