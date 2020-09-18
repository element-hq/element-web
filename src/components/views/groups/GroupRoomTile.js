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
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import dis from '../../../dispatcher/dispatcher';
import { GroupRoomType } from '../../../groups';
import MatrixClientContext from "../../../contexts/MatrixClientContext";

class GroupRoomTile extends React.Component {
    static propTypes = {
        groupId: PropTypes.string.isRequired,
        groupRoom: GroupRoomType.isRequired,
    };

    static contextType = MatrixClientContext

    onClick = e => {
        dis.dispatch({
            action: 'view_group_room',
            groupId: this.props.groupId,
            groupRoomId: this.props.groupRoom.roomId,
        });
    };

    render() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const avatarUrl = this.context.mxcUrlToHttp(
            this.props.groupRoom.avatarUrl,
            36, 36, 'crop',
        );

        const av = (
            <BaseAvatar name={this.props.groupRoom.displayname}
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
                    { this.props.groupRoom.displayname }
                </div>
            </AccessibleButton>
        );
    }
}

export default GroupRoomTile;
