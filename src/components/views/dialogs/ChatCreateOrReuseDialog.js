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
import sdk from '../../../index';
import dis from '../../../dispatcher';
import MatrixClientPeg from '../../../MatrixClientPeg';
import DMRoomMap from '../../../utils/DMRoomMap';
import AccessibleButton from '../elements/AccessibleButton';
import Unread from '../../../Unread';
import classNames from 'classnames';
import createRoom from '../../../createRoom';

export default class CreateOrReuseChatDialog extends React.Component {

    constructor(props) {
        super(props);
        this.onNewDMClick = this.onNewDMClick.bind(this);
        this.onRoomTileClick = this.onRoomTileClick.bind(this);
    }

    onNewDMClick() {
        createRoom({dmUserId: this.props.userId});
        this.props.onFinished(true);
    }

    onRoomTileClick(roomId) {
        dis.dispatch({
            action: 'view_room',
            room_id: roomId,
        });
        this.props.onFinished(true);
    }

    render() {
        const client = MatrixClientPeg.get();

        const dmRoomMap = new DMRoomMap(client);
        const dmRooms = dmRoomMap.getDMRoomsForUserId(this.props.userId);

        const RoomTile = sdk.getComponent("rooms.RoomTile");

        const tiles = [];
        for (const roomId of dmRooms) {
            const room = client.getRoom(roomId);
            if (room) {
                const me = room.getMember(client.credentials.userId);
                const highlight = (
                    room.getUnreadNotificationCount('highlight') > 0 ||
                    me.membership == "invite"
                );
                tiles.push(
                    <RoomTile key={room.roomId} room={room}
                        collapsed={false}
                        selected={false}
                        unread={Unread.doesRoomHaveUnreadMessages(room)}
                        highlight={highlight}
                        isInvite={me.membership == "invite"}
                        onClick={this.onRoomTileClick}
                    />
                );
            }
        }

        const labelClasses = classNames({
            mx_MemberInfo_createRoom_label: true,
            mx_RoomTile_name: true,
        });
        const startNewChat = <AccessibleButton
            className="mx_MemberInfo_createRoom"
            onClick={this.onNewDMClick}
        >
            <div className="mx_RoomTile_avatar">
                <img src="img/create-big.svg" width="26" height="26" />
            </div>
            <div className={labelClasses}><i>Start new chat</i></div>
        </AccessibleButton>;

        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog className='mx_CreateOrReuseChatDialog'
                onFinished={() => {
                    this.props.onFinished(false)
                }}
                title='Create a new chat or reuse an existing one'
            >
                You already have existing direct chats with this user:
                {tiles}
                {startNewChat}
            </BaseDialog>
        );
    }
}

CreateOrReuseChatDialog.propTyps = {
    userId: React.PropTypes.string.isRequired,
    onFinished: React.PropTypes.func.isRequired,
};
