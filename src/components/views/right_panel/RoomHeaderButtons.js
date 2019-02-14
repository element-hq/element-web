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

export default class RoomHeaderButtons extends HeaderButtons {
    constructor(props) {
        super(props, RightPanel.Phase.RoomMemberList);
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
                this.setPhase(RightPanel.Phase.RoomMemberList);
            }
        } else if (payload.action === "view_room") {
            this.setPhase(RightPanel.Phase.RoomMemberList);
        }
    }

    renderButtons() {
        const membersPhases = [
            RightPanel.Phase.RoomMemberList,
            RightPanel.Phase.RoomMemberInfo,
        ];

        return [
            <HeaderButton key="membersButton" name="membersButton"
                title={_t('Members')}
                isHighlighted={this.isPhase(membersPhases)}
                clickPhase={RightPanel.Phase.RoomMemberList}
                analytics={['Right Panel', 'Member List Button', 'click']}
            />,
            <HeaderButton key="filesButton" name="filesButton"
                title={_t('Files')}
                isHighlighted={this.isPhase(RightPanel.Phase.FilePanel)}
                clickPhase={RightPanel.Phase.FilePanel}
                analytics={['Right Panel', 'File List Button', 'click']}
            />,
            <HeaderButton key="notifsButton" name="notifsButton"
                title={_t('Notifications')}
                isHighlighted={this.isPhase(RightPanel.Phase.NotificationPanel)}
                clickPhase={RightPanel.Phase.NotificationPanel}
                analytics={['Right Panel', 'Notification List Button', 'click']}
            />,
        ];
    }
}
