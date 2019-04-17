/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 New Vector Ltd

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
import { _t } from '../../../languageHandler';
import HeaderButton from './HeaderButton';
import HeaderButtons from './HeaderButtons';
import RightPanel from '../../structures/RightPanel';

const GROUP_PHASES = [
    RightPanel.Phase.GroupMemberInfo,
    RightPanel.Phase.GroupMemberList,
];
const ROOM_PHASES = [
    RightPanel.Phase.GroupRoomList,
    RightPanel.Phase.GroupRoomInfo,
];

export default class GroupHeaderButtons extends HeaderButtons {
    constructor(props) {
        super(props, RightPanel.Phase.GroupMemberList);
        this._onMembersClicked = this._onMembersClicked.bind(this);
        this._onRoomsClicked = this._onRoomsClicked.bind(this);
    }

    onAction(payload) {
        super.onAction(payload);

        if (payload.action === "view_user") {
            if (payload.member) {
                this.setPhase(RightPanel.Phase.RoomMemberInfo, {member: payload.member});
            } else {
                this.setPhase(RightPanel.Phase.GroupMemberList);
            }
        } else if (payload.action === "view_group") {
            this.setPhase(RightPanel.Phase.GroupMemberList);
        } else if (payload.action === "view_group_room") {
            this.setPhase(RightPanel.Phase.GroupRoomInfo, {groupRoomId: payload.groupRoomId, groupId: payload.groupId});
        } else if (payload.action === "view_group_room_list") {
            this.setPhase(RightPanel.Phase.GroupRoomList);
        } else if (payload.action === "view_group_member_list") {
            this.setPhase(RightPanel.Phase.GroupMemberList);
        } else if (payload.action === "view_group_user") {
            this.setPhase(RightPanel.Phase.GroupMemberInfo, {member: payload.member});
        }
    }

    _onMembersClicked() {
        this.togglePhase(RightPanel.Phase.GroupMemberList, GROUP_PHASES);
    }

    _onRoomsClicked() {
        this.togglePhase(RightPanel.Phase.GroupRoomList, ROOM_PHASES);
    }

    renderButtons() {
        return [
            <HeaderButton key="groupMembersButton" name="groupMembersButton"
                title={_t('Members')}
                isHighlighted={this.isPhase(GROUP_PHASES)}
                onClick={this._onMembersClicked}
                analytics={['Right Panel', 'Group Member List Button', 'click']}
            />,
            <HeaderButton key="roomsButton" name="roomsButton"
                title={_t('Rooms')}
                isHighlighted={this.isPhase(ROOM_PHASES)}
                onClick={this._onRoomsClicked}
                analytics={['Right Panel', 'Group Room List Button', 'click']}
            />,
        ];
    }
}
