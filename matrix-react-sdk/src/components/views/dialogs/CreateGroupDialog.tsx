/*
Copyright 2017 Vector Creations Ltd

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

import dis from '../../../dispatcher/dispatcher';
import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import BaseDialog from "./BaseDialog";
import Spinner from "../elements/Spinner";

interface IProps {
    onFinished: (success: boolean) => void;
}

interface IState {
    groupName: string;
    groupId: string;
    groupIdError: string;
    creating: boolean;
    createError: Error;
}

@replaceableComponent("views.dialogs.CreateGroupDialog")
export default class CreateGroupDialog extends React.Component<IProps, IState> {
    public state = {
        groupName: '',
        groupId: '',
        groupIdError: '',
        creating: false,
        createError: null,
    };

    private onGroupNameChange = (e: React.FormEvent<HTMLInputElement>): void => {
        this.setState({
            groupName: e.currentTarget.value,
        });
    };

    private onGroupIdChange = (e: React.FormEvent<HTMLInputElement>): void => {
        this.setState({
            groupId: e.currentTarget.value,
        });
    };

    private onGroupIdBlur = (): void => {
        this.checkGroupId();
    };

    private checkGroupId() {
        let error = null;
        if (!this.state.groupId) {
            error = _t("Community IDs cannot be empty.");
        } else if (!/^[a-z0-9=_\-./]*$/.test(this.state.groupId)) {
            error = _t("Community IDs may only contain characters a-z, 0-9, or '=_-./'");
        }
        this.setState({
            groupIdError: error,
            // Reset createError to get rid of now stale error message
            createError: null,
        });
        return error;
    }

    private onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (this.checkGroupId()) return;

        const profile: any = {};
        if (this.state.groupName !== '') {
            profile.name = this.state.groupName;
        }
        this.setState({ creating: true });
        MatrixClientPeg.get().createGroup({
            localpart: this.state.groupId,
            profile: profile,
        }).then((result) => {
            dis.dispatch({
                action: 'view_group',
                group_id: result.group_id,
                group_is_new: true,
            });
            this.props.onFinished(true);
        }).catch((e) => {
            this.setState({ createError: e });
        }).finally(() => {
            this.setState({ creating: false });
        });
    };

    private onCancel = () => {
        this.props.onFinished(false);
    };

    render() {
        if (this.state.creating) {
            return <Spinner />;
        }

        let createErrorNode;
        if (this.state.createError) {
            // XXX: We should catch errcodes and give sensible i18ned messages for them,
            // rather than displaying what the server gives us, but synapse doesn't give
            // any yet.
            createErrorNode = <div className="error" role="alert">
                <div>{ _t('Something went wrong whilst creating your community') }</div>
                <div>{ this.state.createError.message }</div>
            </div>;
        }

        return (
            <BaseDialog
                className="mx_CreateGroupDialog"
                onFinished={this.props.onFinished}
                title={_t('Create Community')}
            >
                <form onSubmit={this.onFormSubmit}>
                    <div className="mx_Dialog_content">
                        <div className="mx_CreateGroupDialog_inputRow">
                            <div className="mx_CreateGroupDialog_label">
                                <label htmlFor="groupname">{ _t('Community Name') }</label>
                            </div>
                            <div>
                                <input
                                    id="groupname"
                                    className="mx_CreateGroupDialog_input"
                                    autoFocus={true}
                                    size={64}
                                    placeholder={_t('Example')}
                                    onChange={this.onGroupNameChange}
                                    value={this.state.groupName}
                                />
                            </div>
                        </div>
                        <div className="mx_CreateGroupDialog_inputRow">
                            <div className="mx_CreateGroupDialog_label">
                                <label htmlFor="groupid">{ _t('Community ID') }</label>
                            </div>
                            <div className="mx_CreateGroupDialog_input_group">
                                <span className="mx_CreateGroupDialog_prefix">+</span>
                                <input id="groupid"
                                    className="mx_CreateGroupDialog_input mx_CreateGroupDialog_input_hasPrefixAndSuffix"
                                    size={32}
                                    placeholder={_t('example')}
                                    onChange={this.onGroupIdChange}
                                    onBlur={this.onGroupIdBlur}
                                    value={this.state.groupId}
                                />
                                <span className="mx_CreateGroupDialog_suffix">
                                    :{ MatrixClientPeg.get().getDomain() }
                                </span>
                            </div>
                        </div>
                        <div className="error">
                            { this.state.groupIdError }
                        </div>
                        { createErrorNode }
                    </div>
                    <div className="mx_Dialog_buttons">
                        <input type="submit" value={_t('Create')} className="mx_Dialog_primary" />
                        <button onClick={this.onCancel}>
                            { _t("Cancel") }
                        </button>
                    </div>
                </form>
            </BaseDialog>
        );
    }
}
