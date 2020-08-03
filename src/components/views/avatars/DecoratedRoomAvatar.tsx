/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import { Room } from "matrix-js-sdk/src/models/room";

import { TagID } from '../../../stores/room-list/models';
import RoomAvatar from "./RoomAvatar";
import RoomTileIcon from "../rooms/RoomTileIcon";
import NotificationBadge from '../rooms/NotificationBadge';
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { NotificationState } from "../../../stores/notifications/NotificationState";

interface IProps {
    room: Room;
    avatarSize: number;
    tag: TagID;
    displayBadge?: boolean;
    forceCount?: boolean;
    oobData?: object;
    viewAvatarOnClick?: boolean;
}

interface IState {
    notificationState?: NotificationState;
}

export default class DecoratedRoomAvatar extends React.PureComponent<IProps, IState> {

    constructor(props: IProps) {
        super(props);

        this.state = {
            notificationState: RoomNotificationStateStore.instance.getRoomState(this.props.room),
        };
    }

    public render(): React.ReactNode {
        let badge: React.ReactNode;
        if (this.props.displayBadge) {
            badge = <NotificationBadge
                notification={this.state.notificationState}
                forceCount={this.props.forceCount}
                roomId={this.props.room.roomId}
            />;
        }

        return <div className="mx_DecoratedRoomAvatar">
            <RoomAvatar
                room={this.props.room}
                width={this.props.avatarSize}
                height={this.props.avatarSize}
                oobData={this.props.oobData}
                viewAvatarOnClick={this.props.viewAvatarOnClick}
            />
            <RoomTileIcon room={this.props.room} />
            {badge}
        </div>;
    }
}
