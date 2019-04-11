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

const MEMBER_PHASES = [
    RightPanel.Phase.RoomMemberList,
    RightPanel.Phase.RoomMemberInfo,
    RightPanel.Phase.Room3pidMemberInfo,
];

export default class RoomHeaderButtons extends HeaderButtons {
    constructor(props) {
        super(props, RightPanel.Phase.RoomMemberList);
        this._onMembersClicked = this._onMembersClicked.bind(this);
        this._onFilesClicked = this._onFilesClicked.bind(this);
        this._onNotificationsClicked = this._onNotificationsClicked.bind(this);
    }

    onAction(payload) {
        super.onAction(payload);
        if (payload.action === "view_user") {
            if (payload.member) {
                this.setPhase(RightPanel.Phase.RoomMemberInfo, {member: payload.member});
            } else {
                this.setPhase(RightPanel.Phase.RoomMemberList);
            }
        } else if (payload.action === "view_room" && !this.props.collapsedRhs) {
            this.setPhase(RightPanel.Phase.RoomMemberList);
        } else if (payload.action === "view_3pid_invite") {
            if (payload.event) {
                this.setPhase(RightPanel.Phase.Room3pidMemberInfo, {event: payload.event});
            } else {
                this.setPhase(RightPanel.Phase.RoomMemberList);
            }
        }
    }

    _onMembersClicked() {
        this.togglePhase(RightPanel.Phase.RoomMemberList, MEMBER_PHASES);
    }

    _onFilesClicked() {
        this.togglePhase(RightPanel.Phase.FilePanel);
    }

    _onNotificationsClicked() {
        this.togglePhase(RightPanel.Phase.NotificationPanel);
    }

    renderButtons() {
        return [
            <HeaderButton key="membersButton" name="membersButton"
                title={_t('Members')}
                isHighlighted={this.isPhase(MEMBER_PHASES)}
                onClick={this._onMembersClicked}
                analytics={['Right Panel', 'Member List Button', 'click']}
            />,
            <HeaderButton key="filesButton" name="filesButton"
                title={_t('Files')}
                isHighlighted={this.isPhase(RightPanel.Phase.FilePanel)}
                onClick={this._onFilesClicked}
                analytics={['Right Panel', 'File List Button', 'click']}
            />,
            <HeaderButton key="notifsButton" name="notifsButton"
                title={_t('Notifications')}
                isHighlighted={this.isPhase(RightPanel.Phase.NotificationPanel)}
                onClick={this._onNotificationsClicked}
                analytics={['Right Panel', 'Notification List Button', 'click']}
            />,
        ];
    }
}
