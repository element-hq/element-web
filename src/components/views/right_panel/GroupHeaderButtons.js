/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import HeaderButtons, {HEADER_KIND_GROUP} from './HeaderButtons';
import {RIGHT_PANEL_PHASES} from "../../../stores/RightPanelStorePhases";
import {Action} from "../../../dispatcher/actions";
import {ActionPayload} from "../../../dispatcher/payloads";

const GROUP_PHASES = [
    RIGHT_PANEL_PHASES.GroupMemberInfo,
    RIGHT_PANEL_PHASES.GroupMemberList,
];
const ROOM_PHASES = [
    RIGHT_PANEL_PHASES.GroupRoomList,
    RIGHT_PANEL_PHASES.GroupRoomInfo,
];

export default class GroupHeaderButtons extends HeaderButtons {
    constructor(props) {
        super(props, HEADER_KIND_GROUP);
        this._onMembersClicked = this._onMembersClicked.bind(this);
        this._onRoomsClicked = this._onRoomsClicked.bind(this);
    }

    onAction(payload: ActionPayload) {
        super.onAction(payload);

        if (payload.action === Action.ViewUser) {
            if (payload.member) {
                this.setPhase(RIGHT_PANEL_PHASES.RoomMemberInfo, {member: payload.member});
            } else {
                this.setPhase(RIGHT_PANEL_PHASES.GroupMemberList);
            }
        } else if (payload.action === "view_group") {
            this.setPhase(RIGHT_PANEL_PHASES.GroupMemberList);
        } else if (payload.action === "view_group_room") {
            this.setPhase(
                RIGHT_PANEL_PHASES.GroupRoomInfo,
                {groupRoomId: payload.groupRoomId, groupId: payload.groupId},
            );
        } else if (payload.action === "view_group_room_list") {
            this.setPhase(RIGHT_PANEL_PHASES.GroupRoomList);
        } else if (payload.action === "view_group_member_list") {
            this.setPhase(RIGHT_PANEL_PHASES.GroupMemberList);
        } else if (payload.action === "view_group_user") {
            this.setPhase(RIGHT_PANEL_PHASES.GroupMemberInfo, {member: payload.member});
        }
    }

    _onMembersClicked() {
        if (this.state.phase === RIGHT_PANEL_PHASES.GroupMemberInfo) {
            // send the active phase to trigger a toggle
            this.setPhase(RIGHT_PANEL_PHASES.GroupMemberInfo);
        } else {
            // This toggles for us, if needed
            this.setPhase(RIGHT_PANEL_PHASES.GroupMemberList);
        }
    }

    _onRoomsClicked() {
        // This toggles for us, if needed
        this.setPhase(RIGHT_PANEL_PHASES.GroupRoomList);
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
