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
import sdk from '../../index';
import { _t } from '../../languageHandler';
import WithMatrixClient from '../../wrappers/WithMatrixClient';
import AccessibleButton from '../views/elements/AccessibleButton';
import dis from '../../dispatcher';
import PropTypes from 'prop-types';
import Modal from '../../Modal';

const GroupTile = React.createClass({
    displayName: 'GroupTile',

    propTypes: {
        groupId: PropTypes.string.isRequired,
    },

    onClick: function(e) {
        e.preventDefault();
        dis.dispatch({
            action: 'view_group',
            group_id: this.props.groupId,
        });
    },

    render: function() {
        return <a onClick={this.onClick} href="#">{this.props.groupId}</a>;
    }
});

module.exports = WithMatrixClient(React.createClass({
    displayName: 'GroupList',

    propTypes: {
        matrixClient: React.PropTypes.object.isRequired,
    },

    getInitialState: function() {
        return {
            groups: null,
            error: null,
        };
    },

    componentWillMount: function() {
        this._fetch();
    },

    componentWillUnmount: function() {
    },

    _onCreateGroupClick: function() {
        const CreateGroupDialog = sdk.getComponent("dialogs.CreateGroupDialog");
        Modal.createDialog(CreateGroupDialog);
    },

    _fetch: function() {
        this.props.matrixClient.getJoinedGroups().done((result) => {
            this.setState({groups: result.groups, error: null});
        }, (err) => {
            this.setState({result: null, error: err});
        });
    },

    render: function() {
        const Loader = sdk.getComponent("elements.Spinner");
        const SimpleRoomHeader = sdk.getComponent('rooms.SimpleRoomHeader');

        let content;
        if (this.state.groups) {
            let groupNodes = [];
            this.state.groups.forEach((g) => {
                groupNodes.push(
                    <div key={g}>
                        <GroupTile groupId={g} />
                    </div>
                );
            });
            content = <div>{groupNodes}</div>;
        } else if (this.state.error) {
            content = <div className="mx_MyGroups_error">
                Error whilst fetching joined groups
            </div>;
        }

        return <div className="mx_MyGroups">
            <SimpleRoomHeader title={ _t("Groups") } />
            <div className='mx_MyGroups_buttonRow'>
                <AccessibleButton className='mx_UserSettings_button' onClick={this._onCreateGroupClick}>
                    {_t('Create a new group')}
                </AccessibleButton>
            </div>
            You are a member of these groups:
            {content}
        </div>;
    },
}));
