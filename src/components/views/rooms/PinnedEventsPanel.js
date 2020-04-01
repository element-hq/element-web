/*
Copyright 2017 Travis Ralston
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

import React from "react";
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import AccessibleButton from "../elements/AccessibleButton";
import PinnedEventTile from "./PinnedEventTile";
import { _t } from '../../../languageHandler';
import PinningUtils from "../../../utils/PinningUtils";

export default createReactClass({
    displayName: 'PinnedEventsPanel',
    propTypes: {
        // The Room from the js-sdk we're going to show pinned events for
        room: PropTypes.object.isRequired,

        onCancelClick: PropTypes.func,
    },

    getInitialState: function() {
        return {
            loading: true,
        };
    },

    componentDidMount: function() {
        this._updatePinnedMessages();
        MatrixClientPeg.get().on("RoomState.events", this._onStateEvent);
    },

    componentWillUnmount: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("RoomState.events", this._onStateEvent);
        }
    },

    _onStateEvent: function(ev) {
        if (ev.getRoomId() === this.props.room.roomId && ev.getType() === "m.room.pinned_events") {
            this._updatePinnedMessages();
        }
    },

    _updatePinnedMessages: function() {
        const pinnedEvents = this.props.room.currentState.getStateEvents("m.room.pinned_events", "");
        if (!pinnedEvents || !pinnedEvents.getContent().pinned) {
            this.setState({ loading: false, pinned: [] });
        } else {
            const promises = [];
            const cli = MatrixClientPeg.get();

            pinnedEvents.getContent().pinned.map((eventId) => {
                promises.push(cli.getEventTimeline(this.props.room.getUnfilteredTimelineSet(), eventId, 0).then(
                (timeline) => {
                    const event = timeline.getEvents().find((e) => e.getId() === eventId);
                    return {eventId, timeline, event};
                }).catch((err) => {
                    console.error("Error looking up pinned event " + eventId + " in room " + this.props.room.roomId);
                    console.error(err);
                    return null; // return lack of context to avoid unhandled errors
                }));
            });

            Promise.all(promises).then((contexts) => {
                // Filter out the messages before we try to render them
                const pinned = contexts.filter((context) => PinningUtils.isPinnable(context.event));

                this.setState({ loading: false, pinned });
            });
        }

        this._updateReadState();
    },

    _updateReadState: function() {
        const pinnedEvents = this.props.room.currentState.getStateEvents("m.room.pinned_events", "");
        if (!pinnedEvents) return; // nothing to read

        let readStateEvents = [];
        const readPinsEvent = this.props.room.getAccountData("im.vector.room.read_pins");
        if (readPinsEvent && readPinsEvent.getContent()) {
            readStateEvents = readPinsEvent.getContent().event_ids || [];
        }

        if (!readStateEvents.includes(pinnedEvents.getId())) {
            readStateEvents.push(pinnedEvents.getId());

            // Only keep the last 10 event IDs to avoid infinite growth
            readStateEvents = readStateEvents.reverse().splice(0, 10).reverse();

            MatrixClientPeg.get().setRoomAccountData(this.props.room.roomId, "im.vector.room.read_pins", {
                event_ids: readStateEvents,
            });
        }
    },

    _getPinnedTiles: function() {
        if (this.state.pinned.length === 0) {
            return (<div>{ _t("No pinned messages.") }</div>);
        }

        return this.state.pinned.map((context) => {
            return (<PinnedEventTile key={context.event.getId()}
                                     mxRoom={this.props.room}
                                     mxEvent={context.event}
                                     onUnpinned={this._updatePinnedMessages} />);
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
                    <AccessibleButton className="mx_PinnedEventsPanel_cancel" onClick={this.props.onCancelClick}>
                        <img className="mx_filterFlipColor" src={require("../../../../res/img/cancel.svg")} width="18" height="18" />
                    </AccessibleButton>
                    <h3 className="mx_PinnedEventsPanel_header">{ _t("Pinned Messages") }</h3>
                    { tiles }
                </div>
            </div>
        );
    },
});
