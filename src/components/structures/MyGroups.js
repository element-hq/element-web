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
import { _t, _tJsx } from '../../languageHandler';
import withMatrixClient from '../../wrappers/withMatrixClient';
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
    },
});

export default withMatrixClient(React.createClass({
    displayName: 'MyGroups',

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

    _onCreateGroupClick: function() {
        const CreateGroupDialog = sdk.getComponent("dialogs.CreateGroupDialog");
        Modal.createTrackedDialog('Create Group', '', CreateGroupDialog);
    },

    _fetch: function() {
        this.props.matrixClient.getJoinedGroups().done((result) => {
            this.setState({groups: result.groups, error: null});
        }, (err) => {
            this.setState({groups: null, error: err});
        });
    },

    render: function() {
        const Loader = sdk.getComponent("elements.Spinner");
        const SimpleRoomHeader = sdk.getComponent('rooms.SimpleRoomHeader');
        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        let content;
        if (this.state.groups) {
            const groupNodes = [];
            this.state.groups.forEach((g) => {
                groupNodes.push(
                    <div key={g}>
                        <GroupTile groupId={g} />
                    </div>,
                );
            });
            content = <div>
                <div>{_t('You are a member of these groups:')}</div>
                {groupNodes}
            </div>;
        } else if (this.state.error) {
            content = <div className="mx_MyGroups_error">
                {_t('Error whilst fetching joined groups')}
            </div>;
        } else {
            content = <Loader />;
        }

        return <div className="mx_MyGroups">
            <SimpleRoomHeader title={ _t("Groups") } />
            <div className='mx_MyGroups_joinCreateBox'>
                <div className="mx_MyGroups_createBox">
                    <div className="mx_MyGroups_joinCreateHeader">
                        {_t('Create a new group')}
                    </div>
                    <AccessibleButton className='mx_MyGroups_joinCreateButton' onClick={this._onCreateGroupClick}>
                        <TintableSvg src="img/icons-create-room.svg" width="50" height="50" />
                    </AccessibleButton>
                    {_t(
                        'Create a group to represent your community! '+
                        'Define a set of rooms and your own custom homepage '+
                        'to mark out your space in the Matrix universe.',
                    )}
                </div>
                <div className="mx_MyGroups_joinBox">
                    <div className="mx_MyGroups_joinCreateHeader">
                        {_t('Join an existing group')}
                    </div>
                    <AccessibleButton className='mx_MyGroups_joinCreateButton' onClick={this._onJoinGroupClick}>
                        <TintableSvg src="img/icons-create-room.svg" width="50" height="50" />
                    </AccessibleButton>
                    {_tJsx(
                        'To join an exisitng group you\'ll have to '+
                        'know its group identifier; this will look '+
                        'something like <i>+example:matrix.org</i>.',
                        /<i>(.*)<\/i>/,
                        (sub) => <i>{sub}</i>,
                    )}
                </div>
            </div>
            <div className="mx_MyGroups_content">
                {content}
            </div>
        </div>;
    },
}));
