/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import HeaderButtons, {HeaderKind} from './HeaderButtons';
import {RightPanelPhases} from "../../../stores/RightPanelStorePhases";
import {Action} from "../../../dispatcher/actions";
import {ActionPayload} from "../../../dispatcher/payloads";

const MEMBER_PHASES = [
    RightPanelPhases.RoomMemberList,
    RightPanelPhases.RoomMemberInfo,
    RightPanelPhases.EncryptionPanel,
    RightPanelPhases.Room3pidMemberInfo,
];

export default class RoomHeaderButtons extends HeaderButtons {
    constructor(props) {
        super(props, HeaderKind.Room);
        this._onMembersClicked = this._onMembersClicked.bind(this);
        this._onFilesClicked = this._onFilesClicked.bind(this);
        this._onNotificationsClicked = this._onNotificationsClicked.bind(this);
    }

    onAction(payload: ActionPayload) {
        super.onAction(payload);
        if (payload.action === Action.ViewUser) {
            if (payload.member) {
                this.setPhase(RightPanelPhases.RoomMemberInfo, {member: payload.member});
            } else {
                this.setPhase(RightPanelPhases.RoomMemberList);
            }
        } else if (payload.action === "view_3pid_invite") {
            if (payload.event) {
                this.setPhase(RightPanelPhases.Room3pidMemberInfo, {event: payload.event});
            } else {
                this.setPhase(RightPanelPhases.RoomMemberList);
            }
        }
    }

    _onMembersClicked() {
        if (this.state.phase === RightPanelPhases.RoomMemberInfo) {
            // send the active phase to trigger a toggle
            // XXX: we should pass refireParams here but then it won't collapse as we desire it to
            this.setPhase(RightPanelPhases.RoomMemberInfo);
        } else {
            // This toggles for us, if needed
            this.setPhase(RightPanelPhases.RoomMemberList);
        }
    }

    _onFilesClicked() {
        // This toggles for us, if needed
        this.setPhase(RightPanelPhases.FilePanel);
    }

    _onNotificationsClicked() {
        // This toggles for us, if needed
        this.setPhase(RightPanelPhases.NotificationPanel);
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
                isHighlighted={this.isPhase(RightPanelPhases.FilePanel)}
                onClick={this._onFilesClicked}
                analytics={['Right Panel', 'File List Button', 'click']}
            />,
            <HeaderButton key="notifsButton" name="notifsButton"
                title={_t('Notifications')}
                isHighlighted={this.isPhase(RightPanelPhases.NotificationPanel)}
                onClick={this._onNotificationsClicked}
                analytics={['Right Panel', 'Notification List Button', 'click']}
            />,
        ];
    }
}
