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
import dis from '../../../dispatcher';
import HeaderButton from './HeaderButton';
import HeaderButtons from './HeaderButtons';
import RightPanel from '../../structures/RightPanel';

export default class GroupHeaderButtons extends HeaderButtons {

    constructor(props) {
        super(props, RightPanel.Phase.GroupMemberList);
    }

    onAction(payload) {
        super.onAction(payload);

        if (payload.action === "view_user") {
            dis.dispatch({
                action: 'show_right_panel',
            });
            if (payload.member) {
                this.setPhase(RightPanel.Phase.RoomMemberInfo, {member: payload.member});
            } else {
                this.setPhase(RightPanel.Phase.GroupMemberList);
            }
        } else if (payload.action === "view_group") {
            this.setPhase(RightPanel.Phase.GroupMemberList);
        } else if (payload.action === "view_group_room") {
            this.setPhase(RightPanel.Phase.GroupRoomInfo, {groupRoomId: payload.groupRoomId});
        } else if (payload.action === "view_group_room_list") {
            this.setPhase(RightPanel.Phase.GroupRoomList);
        } else if (payload.action === "view_group_member_list") {
            this.setPhase(RightPanel.Phase.GroupMemberList);
        } else if (payload.action === "view_group_user") {
            this.setPhase(RightPanel.Phase.GroupMemberInfo, {member: payload.member});
        }
    }

    renderButtons() {
        const isPhaseGroup = [
            RightPanel.Phase.GroupMemberInfo,
            RightPanel.Phase.GroupMemberList,
        ].includes(this.state.phase);
        const isPhaseRoom = [
            RightPanel.Phase.GroupRoomList,
            RightPanel.Phase.GroupRoomInfo,
        ].includes(this.state.phase);

        return [
            <HeaderButton key="_groupMembersButton" title={_t('Members')} iconSrc="img/icons-people.svg"
                isHighlighted={isPhaseGroup}
                clickPhase={RightPanel.Phase.GroupMemberList}
                analytics={['Right Panel', 'Group Member List Button', 'click']}
            />,
            <HeaderButton key="_roomsButton" title={_t('Rooms')} iconSrc="img/icons-room.svg"
                isHighlighted={isPhaseRoom}
                clickPhase={RightPanel.Phase.GroupRoomList}
                analytics={['Right Panel', 'Group Room List Button', 'click']}
            />,
        ];
    }
}
