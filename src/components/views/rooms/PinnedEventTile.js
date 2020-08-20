/*
Copyright 2017 Travis Ralston

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

import React from "react";
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import AccessibleButton from "../elements/AccessibleButton";
import MessageEvent from "../messages/MessageEvent";
import MemberAvatar from "../avatars/MemberAvatar";
import { _t } from '../../../languageHandler';
import {formatFullDate} from '../../../DateUtils';

export default createReactClass({
    displayName: 'PinnedEventTile',
    propTypes: {
        mxRoom: PropTypes.object.isRequired,
        mxEvent: PropTypes.object.isRequired,
        onUnpinned: PropTypes.func,
    },
    onTileClicked: function() {
        dis.dispatch({
            action: 'view_room',
            event_id: this.props.mxEvent.getId(),
            highlighted: true,
            room_id: this.props.mxEvent.getRoomId(),
        });
    },
    onUnpinClicked: function() {
        const pinnedEvents = this.props.mxRoom.currentState.getStateEvents("m.room.pinned_events", "");
        if (!pinnedEvents || !pinnedEvents.getContent().pinned) {
            // Nothing to do: already unpinned
            if (this.props.onUnpinned) this.props.onUnpinned();
        } else {
            const pinned = pinnedEvents.getContent().pinned;
            const index = pinned.indexOf(this.props.mxEvent.getId());
            if (index !== -1) {
                pinned.splice(index, 1);
                MatrixClientPeg.get().sendStateEvent(this.props.mxRoom.roomId, 'm.room.pinned_events', {pinned}, '')
                .then(() => {
                    if (this.props.onUnpinned) this.props.onUnpinned();
                });
            } else if (this.props.onUnpinned) this.props.onUnpinned();
        }
    },
    _canUnpin: function() {
        return this.props.mxRoom.currentState.mayClientSendStateEvent('m.room.pinned_events', MatrixClientPeg.get());
    },
    render: function() {
        const sender = this.props.mxEvent.getSender();
        // Get the latest sender profile rather than historical
        const senderProfile = this.props.mxRoom.getMember(sender);
        const avatarSize = 40;

        let unpinButton = null;
        if (this._canUnpin()) {
            unpinButton = (
                <AccessibleButton onClick={this.onUnpinClicked} className="mx_PinnedEventTile_unpinButton">
                    <img src={require("../../../../res/img/cancel-red.svg")} width="8" height="8" alt={_t('Unpin Message')} title={_t('Unpin Message')} />
                </AccessibleButton>
            );
        }

        return (
            <div className="mx_PinnedEventTile">
                <div className="mx_PinnedEventTile_actions">
                    <AccessibleButton className="mx_PinnedEventTile_gotoButton mx_textButton" onClick={this.onTileClicked}>
                        { _t("Jump to message") }
                    </AccessibleButton>
                    { unpinButton }
                </div>

                <span className="mx_PinnedEventTile_senderAvatar">
                    <MemberAvatar member={senderProfile} width={avatarSize} height={avatarSize} fallbackUserId={sender} />
                </span>
                <span className="mx_PinnedEventTile_sender">
                    { senderProfile ? senderProfile.name : sender }
                </span>
                <span className="mx_PinnedEventTile_timestamp">
                    { formatFullDate(new Date(this.props.mxEvent.getTs())) }
                </span>
                <div className="mx_PinnedEventTile_message">
                    <MessageEvent mxEvent={this.props.mxEvent} className="mx_PinnedEventTile_body" maxImageHeight={150}
                                  onHeightChanged={() => {}} // we need to give this, apparently
                    />
                </div>
            </div>
        );
    },
});
