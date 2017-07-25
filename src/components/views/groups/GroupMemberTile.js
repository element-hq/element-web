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
import withMatrixClient from '../../../wrappers/withMatrixClient';
import Matrix from "matrix-js-sdk";

export default withMatrixClient(React.createClass({
    displayName: 'GroupMemberTile',

    propTypes: {
        matrixClient: PropTypes.object,
        member: PropTypes.shape({
            user_id: PropTypes.string.isRequired,
        }).isRequired,
    },

    getInitialState: function() {
        return {};
    },

    onClick: function(e) {
        const member = new Matrix.RoomMember(null, this.props.member.user_id);
        dis.dispatch({
            action: 'view_user',
            member: member,
        });
    },

    getPowerLabel: function() {
        return _t("%(userName)s (power %(powerLevelNumber)s)", {userName: this.props.member.userId, powerLevelNumber: this.props.member.powerLevel});
    },

    render: function() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const EntityTile = sdk.getComponent('rooms.EntityTile');

        const name = this.props.member.user_id;

        const av = (
            <BaseAvatar name={this.props.member.user_id} width={36} height={36} />
        );

        return (
            <EntityTile presenceState="online"
                avatarJsx={av} title={this.getPowerLabel()} onClick={this.onClick}
                name={name} powerLevel={0} suppressOnHover={true}
            />
        );
    }
}));
