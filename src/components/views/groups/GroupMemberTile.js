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
import { GroupMemberType } from '../../../groups';
import withMatrixClient from '../../../wrappers/withMatrixClient';
import Matrix from "matrix-js-sdk";

export default withMatrixClient(React.createClass({
    displayName: 'GroupMemberTile',

    propTypes: {
        matrixClient: PropTypes.object,
        groupId: PropTypes.string.isRequired,
        member: GroupMemberType.isRequired,
    },

    getInitialState: function() {
        return {};
    },

    onClick: function(e) {
        dis.dispatch({
            action: 'view_group_user',
            member: this.props.member,
            groupId: this.props.groupId,
        });
    },

    getPowerLabel: function() {
        return _t("%(userName)s (power %(powerLevelNumber)s)", {userName: this.props.member.userId, powerLevelNumber: this.props.member.powerLevel});
    },

    render: function() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const EntityTile = sdk.getComponent('rooms.EntityTile');

        const name = this.props.member.userId;

        const av = (
            <BaseAvatar name={this.props.member.userId} width={36} height={36} />
        );

        return (
            <EntityTile presenceState="online"
                avatarJsx={av} title={this.getPowerLabel()} onClick={this.onClick}
                name={name} powerLevel={0} suppressOnHover={true}
            />
        );
    }
}));
