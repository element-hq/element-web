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
    _canUnpin: function() {
        return this.props.mxRoom.currentState.mayClientSendStateEvent('m.room.pinned_events', MatrixClientPeg.get());
    },
    render: function() {
        const MessageEvent = sdk.getComponent("views.messages.MessageEvent");
        const MemberAvatar = sdk.getComponent("views.avatars.MemberAvatar");

        const sender = this.props.mxRoom.getMember(this.props.mxEvent.getSender());
        const avatarSize = 40;

        let unpinButton = null;
        if (this._canUnpin()) {
            unpinButton = <img src="img/cancel-red.svg" className="mx_PinnedEventTile_unpinButton" width="8" height="8"
                               onClick={this.onUnpinClicked} alt={_t('Unpin Message')} title={_t('Unpin Message')} />;
        }

        return (
            <div className="mx_PinnedEventTile">
                <div className="mx_PinnedEventTile_actions">
                    <AccessibleButton className="mx_PinnedEventTile_gotoButton mx_textButton" onClick={this.onTileClicked}>
                        { _t("Jump to message") }
                    </AccessibleButton>
                    { unpinButton }
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
                    const event = timeline.getEvents().find(e => e.getId() === eventId);
                    return {eventId, timeline, event};
                }).catch(err => {
                    console.error("Error looking up pinned event " + eventId + " in room " + this.props.room.roomId);
                    console.error(err);
                    return null; // return lack of context to avoid unhandled errors
                }));
            });

            Promise.all(promises).then(contexts => {
                // Filter out the messages before we try to render them
                const pinned = contexts.filter(context => {
                    if (!context) return false; // no context == not applicable for the room
                    if (context.event.getType() !== "m.room.message") return false;
                    if (context.event.isRedacted()) return false;
                    return true;
                });

                this.setState({ loading: false, pinned });
            });
        }
    },

    _getPinnedTiles: function() {
        if (this.state.pinned.length == 0) {
            return <div>{ _t("No pinned messages.") }</div>;
        }

        return this.state.pinned.map(context => {
            return (<PinnedEventTile key={context.event.getId()} mxRoom={this.props.room} mxEvent={context.event} onUnpinned={this._updatePinnedMessages} />);
        });
    },

    render: function() {
        let tiles = <div>{ _t("Loading...") }</div>;
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
