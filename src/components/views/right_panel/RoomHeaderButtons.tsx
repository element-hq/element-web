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
import {_t} from '../../../languageHandler';
import HeaderButton from './HeaderButton';
import HeaderButtons, {HeaderKind} from './HeaderButtons';
import {RightPanelPhases} from "../../../stores/RightPanelStorePhases";
import {Action} from "../../../dispatcher/actions";
import {ActionPayload} from "../../../dispatcher/payloads";
import RightPanelStore from "../../../stores/RightPanelStore";

const ROOM_INFO_PHASES = [
    RightPanelPhases.RoomSummary,
    RightPanelPhases.Widget,
    RightPanelPhases.FilePanel,
    RightPanelPhases.RoomMemberList,
    RightPanelPhases.RoomMemberInfo,
    RightPanelPhases.EncryptionPanel,
    RightPanelPhases.Room3pidMemberInfo,
];

export default class RoomHeaderButtons extends HeaderButtons {
    constructor(props) {
        super(props, HeaderKind.Room);
    }

    protected onAction(payload: ActionPayload) {
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

    private onRoomSummaryClicked = () => {
        // use roomPanelPhase rather than this.state.phase as it remembers the latest one if we close
        const lastPhase = RightPanelStore.getSharedInstance().roomPanelPhase;
        if (ROOM_INFO_PHASES.includes(lastPhase)) {
            if (this.state.phase === lastPhase) {
                this.setPhase(lastPhase);
            } else {
                this.setPhase(lastPhase, RightPanelStore.getSharedInstance().roomPanelPhaseParams);
            }
        } else {
            // This toggles for us, if needed
            this.setPhase(RightPanelPhases.RoomSummary);
        }
    };

    private onNotificationsClicked = () => {
        // This toggles for us, if needed
        this.setPhase(RightPanelPhases.NotificationPanel);
    };

    public renderButtons() {
        return [
            <HeaderButton
                key="notifsButton"
                name="notifsButton"
                title={_t('Notifications')}
                isHighlighted={this.isPhase(RightPanelPhases.NotificationPanel)}
                onClick={this.onNotificationsClicked}
                analytics={['Right Panel', 'Notification List Button', 'click']}
            />,
            <HeaderButton
                key="roomSummaryButton"
                name="roomSummaryButton"
                title={_t('Room Info')}
                isHighlighted={this.isPhase(ROOM_INFO_PHASES)}
                onClick={this.onRoomSummaryClicked}
                analytics={['Right Panel', 'Room Summary Button', 'click']}
            />,
        ];
    }
}
