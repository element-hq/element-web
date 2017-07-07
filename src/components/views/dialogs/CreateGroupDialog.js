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
import PropTypes from 'prop-types';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import { _t } from '../../../languageHandler';
import MatrixClientPeg from '../../../MatrixClientPeg';

// We match fairly liberally and leave it up to the server to reject if
// there are invalid characters etc.
const GROUP_REGEX = /^\+(.*?):(.*)$/;

export default React.createClass({
    displayName: 'CreateGroupDialog',
    propTypes: {
        onFinished: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            groupName: '',
            groupId: '',
            groupError: null,
            creating: false,
            createError: null,
        };
    },

    _onGroupNameChange: function(e) {
        this.setState({
            groupName: e.target.value,
        });
    },

    _onGroupIdChange: function(e) {
        this.setState({
            groupId: e.target.value,
        });
    },

    _onGroupIdBlur: function(e) {
        this._checkGroupId();
    },

    _checkGroupId: function(e) {
        const parsedGroupId = this._parseGroupId(this.state.groupId);
        let error = null;
        if (parsedGroupId === null) {
            error = _t(
                "Group IDs must be of the form +localpart:%(domain)s",
                {domain: MatrixClientPeg.get().getDomain()},
            );
        } else {
            const domain = parsedGroupId[1];
            if (domain !== MatrixClientPeg.get().getDomain()) {
                error = _t(
                    "It is currently only possible to create groups on your own home server: "+
                    "use a group ID ending with %(domain)s",
                    {domain: MatrixClientPeg.get().getDomain()},
                );
            }
        }
        this.setState({
            groupIdError: error,
        });
        return error;
    },

    _onFormSubmit: function(e) {
        e.preventDefault();

        if (this._checkGroupId()) return;

        const parsedGroupId = this._parseGroupId(this.state.groupId);
        const profile = {};
        if (this.state.groupName !== '') {
            profile.name = this.state.groupName;
        }
        this.setState({creating: true});
        MatrixClientPeg.get().createGroup({
            localpart: parsedGroupId[0],
            profile: profile,
        }).then((result) => {
            dis.dispatch({
                action: 'view_group',
                group_id: result.group_id,
            });
            this.props.onFinished(true);
        }).catch((e) => {
            this.setState({createError: e});
        }).finally(() => {
            this.setState({creating: false});
        }).done();
    },

    _onCancel: function() {
        this.props.onFinished(false);
    },

    /**
     * Parse a string that may be a group ID
     * If the string is a valid group ID, return a list of [localpart, domain],
     * otherwise return null.
     *
     * @param {string} groupId The ID of the group
     * @return {string[]} array of localpart, domain
     */
    _parseGroupId: function(groupId) {
        const matches = GROUP_REGEX.exec(this.state.groupId);
        if (!matches || matches.length < 3) {
            return null;
        }
        return [matches[1], matches[2]];
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const Spinner = sdk.getComponent('elements.Spinner');

        if (this.state.creating) {
            return <Spinner />;
        }

        let createErrorNode;
        if (this.state.createError) {
            // XXX: We should catch errcodes and give sensible i18ned messages for them,
            // rather than displaying what the server gives us, but synapse doesn't give
            // any yet.
            createErrorNode = <div className="error">
                <div>{_t('Room creation failed')}</div>
                <div>{this.state.createError.message}</div>
            </div>;
        }

        return (
            <BaseDialog className="mx_CreateGroupDialog" onFinished={this.props.onFinished}
                onEnterPressed={this._onFormSubmit}
                title={_t('Create Group')}
            >
                <form onSubmit={this._onFormSubmit}>
                    <div className="mx_Dialog_content">
                        <div className="mx_CreateGroupDialog_inputRow">
                            <div className="mx_CreateGroupDialog_label">
                                <label htmlFor="groupname">{_t('Group Name')}</label>
                            </div>
                            <div>
                                <input id="groupname" className="mx_CreateGroupDialog_input"
                                    autoFocus={true} size="64"
                                    placeholder={_t('Example')}
                                    onChange={this._onGroupNameChange}
                                    value={this.state.groupName}
                                />
                            </div>
                        </div>
                        <div className="mx_CreateGroupDialog_inputRow">
                            <div className="mx_CreateGroupDialog_label">
                                <label htmlFor="groupid">{_t('Group ID')}</label>
                            </div>
                            <div>
                                <input id="groupid" className="mx_CreateGroupDialog_input"
                                    size="64"
                                    placeholder={_t('+example:%(domain)s', {domain: MatrixClientPeg.get().getDomain()})}
                                    onChange={this._onGroupIdChange}
                                    onBlur={this._onGroupIdBlur}
                                    value={this.state.groupId}
                                />
                            </div>
                        </div>
                        <div className="error">
                            {this.state.groupIdError}
                        </div>
                        {createErrorNode}
                    </div>
                    <div className="mx_Dialog_buttons">
                        <button onClick={this._onCancel}>
                            { _t("Cancel") }
                        </button>
                        <input type="submit" value={_t('Create')} className="mx_Dialog_primary" />
                    </div>
                </form>
            </BaseDialog>
        );
    },
});
