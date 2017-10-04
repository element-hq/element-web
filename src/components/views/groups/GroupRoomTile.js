/*
Copyright 2017 New Vector Ltd

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
import { _t } from '../../../languageHandler';
import PropTypes from 'prop-types';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import { GroupRoomType } from '../../../groups';
import Modal from '../../../Modal';

const GroupRoomTile = React.createClass({
    displayName: 'GroupRoomTile',

    propTypes: {
        groupId: PropTypes.string.isRequired,
        groupRoom: GroupRoomType.isRequired,
    },

    getInitialState: function() {
        return {
            name: this.calculateRoomName(this.props.groupRoom),
        };
    },

    componentWillReceiveProps: function(newProps) {
        this.setState({
            name: this.calculateRoomName(newProps.groupRoom),
        });
    },

    calculateRoomName: function(groupRoom) {
        return groupRoom.name || groupRoom.canonicalAlias || _t("Unnamed Room");
    },

    removeRoomFromGroup: function() {
        const groupId = this.props.groupId;
        const roomName = this.state.name;
        const roomId = this.props.groupRoom.roomId;
        this.context.matrixClient
            .removeRoomFromGroup(groupId, roomId)
            .catch((err) => {
                console.error(`Error whilst removing ${roomId} from ${groupId}`, err);
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createTrackedDialog('Failed to remove room from group', '', ErrorDialog, {
                    title: _t("Failed to remove room from group"),
                    description: _t("Failed to remove '%(roomName)s' from %(groupId)s", {groupId, roomName}),
                });
            });
    },

    onClick: function(e) {
        let roomId;
        let roomAlias;
        if (this.props.groupRoom.canonicalAlias) {
            roomAlias = this.props.groupRoom.canonicalAlias;
        } else {
            roomId = this.props.groupRoom.roomId;
        }
        dis.dispatch({
            action: 'view_room',
            room_id: roomId,
            room_alias: roomAlias,
        });
    },

    onDeleteClick: function(e) {
        const groupId = this.props.groupId;
        const roomName = this.state.name;
        e.preventDefault();
        e.stopPropagation();
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createTrackedDialog('Confirm removal of group from room', '', QuestionDialog, {
            title: _t("Are you sure you want to remove '%(roomName)s' from %(groupId)s?", {roomName, groupId}),
            description: _t("Removing a room from the group will also remove it from the group page."),
            button: _t("Remove"),
            onFinished: (success) => {
                if (success) {
                    this.removeRoomFromGroup();
                }
            },
        });
    },

    render: function() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const avatarUrl = this.context.matrixClient.mxcUrlToHttp(
            this.props.groupRoom.avatarUrl,
            36, 36, 'crop',
        );

        const av = (
            <BaseAvatar name={this.state.name}
                width={36} height={36}
                url={avatarUrl}
            />
        );

        return (
            <AccessibleButton className="mx_GroupRoomTile" onClick={this.onClick}>
                <div className="mx_GroupRoomTile_avatar">
                    { av }
                </div>
                <div className="mx_GroupRoomTile_name">
                    { this.state.name }
                </div>
                <AccessibleButton className="mx_GroupRoomTile_delete" onClick={this.onDeleteClick}>
                    <img src="img/cancel-small.svg" />
                </AccessibleButton>
            </AccessibleButton>
        );
    },
});

GroupRoomTile.contextTypes = {
    matrixClient: React.PropTypes.instanceOf(MatrixClient).isRequired,
};


export default GroupRoomTile;
