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

const GroupRoomTile = React.createClass({
    displayName: 'GroupRoomTile',

    propTypes: {
        groupId: PropTypes.string.isRequired,
        groupRoom: GroupRoomType.isRequired,
    },

    getInitialState: function() {
        return {};
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

    render: function() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        const name = this.props.groupRoom.name ||
            this.props.groupRoom.canonicalAlias ||
            _t("Unnamed Room");
        const avatarUrl = this.context.matrixClient.mxcUrlToHttp(
            this.props.groupRoom.avatarUrl,
            36, 36, 'crop',
        );

        const av = (
            <BaseAvatar name={name}
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
                    { name }
                </div>
            </AccessibleButton>
        );
    },
});

GroupRoomTile.contextTypes = {
    matrixClient: React.PropTypes.instanceOf(MatrixClient).isRequired,
};


export default GroupRoomTile;
