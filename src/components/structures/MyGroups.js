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
import {MatrixClient} from 'matrix-js-sdk';
import sdk from '../../index';
import { _t, _tJsx } from '../../languageHandler';
import withMatrixClient from '../../wrappers/withMatrixClient';
import AccessibleButton from '../views/elements/AccessibleButton';
import dis from '../../dispatcher';
import PropTypes from 'prop-types';
import Modal from '../../Modal';

import FlairStore from '../../stores/FlairStore';

const GroupTile = React.createClass({
    displayName: 'GroupTile',

    propTypes: {
        groupId: PropTypes.string.isRequired,
    },

    contextTypes: {
        matrixClient: React.PropTypes.instanceOf(MatrixClient).isRequired,
    },

    getInitialState() {
        return {
            profile: null,
        };
    },

    componentWillMount: function() {
        FlairStore.getGroupProfileCached(this.context.matrixClient, this.props.groupId).then((profile) => {
            this.setState({profile});
        });
    },

    onClick: function(e) {
        e.preventDefault();
        dis.dispatch({
            action: 'view_group',
            group_id: this.props.groupId,
        });
    },

    render: function() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const profile = this.state.profile || {};
        const name = profile.name || this.props.groupId;
        const desc = profile.shortDescription;
        const httpUrl = profile.avatarUrl ? this.context.matrixClient.mxcUrlToHttp(profile.avatarUrl, 50, 50) : null;
        return <AccessibleButton className="mx_GroupTile" onClick={this.onClick}>
            <div className="mx_GroupTile_avatar">
                <BaseAvatar name={name} url={httpUrl} width={50} height={50} />
            </div>
            <div className="mx_GroupTile_profile">
                <h3 className="mx_GroupTile_name">{ name }</h3>
                <div className="mx_GroupTile_desc">{ desc }</div>
                <div className="mx_GroupTile_groupId">{ this.props.groupId }</div>
            </div>
        </AccessibleButton>;
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
        Modal.createTrackedDialog('Create Community', '', CreateGroupDialog);
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
                groupNodes.push(<GroupTile groupId={g} />);
            });
            content = <div className="mx_MyGroups_joinedGroups">
                { groupNodes }
            </div>;
        } else if (this.state.error) {
            content = <div className="mx_MyGroups_error">
                { _t('Error whilst fetching joined communities') }
            </div>;
        } else {
            content = <Loader />;
        }

        return <div className="mx_MyGroups">
            <SimpleRoomHeader title={_t("Communities")} icon="img/icons-groups.svg" />
            <div className='mx_MyGroups_joinCreateBox'>
                <div className="mx_MyGroups_createBox">
                    <div className="mx_MyGroups_joinCreateHeader">
                        { _t('Create a new community') }
                    </div>
                    <AccessibleButton className='mx_MyGroups_joinCreateButton' onClick={this._onCreateGroupClick}>
                        <TintableSvg src="img/icons-create-room.svg" width="50" height="50" />
                    </AccessibleButton>
                    { _t(
                        'Create a community to represent your community! '+
                        'Define a set of rooms and your own custom homepage '+
                        'to mark out your space in the Matrix universe.',
                    ) }
                </div>
                <div className="mx_MyGroups_joinBox">
                    <div className="mx_MyGroups_joinCreateHeader">
                        { _t('Join an existing community') }
                    </div>
                    <AccessibleButton className='mx_MyGroups_joinCreateButton' onClick={this._onJoinGroupClick}>
                        <TintableSvg src="img/icons-create-room.svg" width="50" height="50" />
                    </AccessibleButton>
                    { _tJsx(
                        'To join an existing community you\'ll have to '+
                        'know its community identifier; this will look '+
                        'something like <i>+example:matrix.org</i>.',
                        /<i>(.*)<\/i>/,
                        (sub) => <i>{ sub }</i>,
                    ) }
                </div>
            </div>
            <div className="mx_MyGroups_content">
                <h3>{ _t('Your Communities') }</h3>
                { content }
            </div>
        </div>;
    },
}));
