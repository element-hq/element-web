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

'use strict';

var React = require('react');
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var sdk = require('matrix-react-sdk');
var AccessibleButton = require('matrix-react-sdk/lib/components/views/elements/AccessibleButton');
var dis = require('matrix-react-sdk/lib/dispatcher');
import { _t } from "matrix-react-sdk/lib/languageHandler";
import { EventTimeline } from "matrix-js-sdk";

const PinnedEventTile = React.createClass({
    displayName: 'PinnedEventTile',
    propTypes: {
        mxRoom: React.PropTypes.object.isRequired,
        mxEvent: React.PropTypes.object.isRequired,
        onUnpinned: React.PropTypes.func,
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
                MatrixClientPeg.get().sendStateEvent(this.props.mxRoom.roomId, 'm.room.pinned_events', {pinned}, '').then(() => {
                    if (this.props.onUnpinned) this.props.onUnpinned();
                });
            } else if (this.props.onUnpinned) this.props.onUnpinned();
        }
    },
    render: function() {
        const MessageEvent = sdk.getComponent("views.messages.MessageEvent");
        const MemberAvatar = sdk.getComponent("views.avatars.MemberAvatar");

        const sender = this.props.mxRoom.getMember(this.props.mxEvent.getSender());
        const avatarSize = 40;

        return (
            <div className="mx_PinnedEventTile">
                <div className="mx_PinnedEventTile_actions">
                    <AccessibleButton className="mx_PinnedEventTile_gotoButton mx_textButton" onClick={this.onTileClicked}>
                        Jump to message
                    </AccessibleButton>
                    <img src="img/cancel-red.svg" className="mx_PinnedEventTile_unpinButton" width="8" height="8"
                         onClick={this.onUnpinClicked} alt={_t('Unpin Message')} title={_t('Unpin Message')} />
                </div>

                <MemberAvatar member={sender} width={avatarSize} height={avatarSize} />
                <span className="mx_PinnedEventTile_sender">
                    {sender.name}
                </span>
                <MessageEvent mxEvent={this.props.mxEvent} className="mx_PinnedEventTile_body" />
            </div>
        );
    }
});

module.exports = React.createClass({
    displayName: 'PinnedEventsPanel',
    propTypes: {
        // The Room from the js-sdk we're going to show pinned events for
        room: React.PropTypes.object.isRequired,

        onCancelClick: React.PropTypes.func,
    },

    getInitialState: function() {
        return {
            loading: true,
        };
    },

    componentDidMount: function() {
        this._updatePinnedMessages();
    },

    _updatePinnedMessages: function() {
        const pinnedEvents = this.props.room.currentState.getStateEvents("m.room.pinned_events", "");
        if (!pinnedEvents || !pinnedEvents.getContent().pinned) {
            this.setState({ loading: false, pinned: [] });
        } else {
            const promises = [];
            const cli = MatrixClientPeg.get();

            pinnedEvents.getContent().pinned.map(eventId => {
                promises.push(cli.getEventTimeline(this.props.room.getUnfilteredTimelineSet(), eventId, 0).then(timeline => {
                    return {eventId, timeline};
                }));
            });

            Promise.all(promises).then(contexts => {
                this.setState({ loading: false, pinned: contexts });
            });
        }
    },

    _getPinnedTiles: function() {
        if (this.state.pinned.length == 0) {
            return <div>No pinned messages.</div>;
        }

        return this.state.pinned.map(pinnedEvent => {
            const event = pinnedEvent.timeline.getEvents().find(e => e.getId() === pinnedEvent.eventId);

            // Don't show non-messages. Technically users can pin state/custom events, but we won't
            // support those events.
            if (event.getType() !== "m.room.message") return '';
            return (<PinnedEventTile key={event.getId()} mxRoom={this.props.room} mxEvent={event} onUnpinned={this._updatePinnedMessages} />);
        });
    },

    render: function() {
        let tiles = <div>Loading...</div>;
        if (this.state && !this.state.loading) {
            tiles = this._getPinnedTiles();
        }

        return (
            <div className="mx_PinnedEventsPanel">
                <div className="mx_PinnedEventsPanel_body">
                    <AccessibleButton className="mx_PinnedEventsPanel_cancel" onClick={this.props.onCancelClick}><img src="img/cancel.svg" width="18" height="18" /></AccessibleButton>
                    <h3 className="mx_PinnedEventsPanel_header">{_t("Pinned Messages")}</h3>
                    { tiles }
                </div>
            </div>
        );
    }
});
