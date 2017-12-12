/*
Copyright 2017 New Vector Ltd

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
import sdk from '../../../index';
import PropTypes from 'prop-types';
import MatrixClientPeg from '../../../MatrixClientPeg';

// For URLs of matrix.to links in the timeline which have been reformatted by
// HttpUtils transformTags to relative links. This excludes event URLs (with `[^\/]*`)
const REGEX_LOCAL_MATRIXTO = /^#\/room\/(([\#\!])[^\/]*)\/(\$[^\/]*)$/;

const Quote = React.createClass({
    statics: {
        isMessageUrl: (url) => {
            return !!REGEX_LOCAL_MATRIXTO.exec(url);
        },
    },

    childContextTypes: {
        matrixClient: React.PropTypes.object,
    },

    props: {
        // The matrix.to url of the event
        url: PropTypes.string,
        // Whether to include an avatar in the pill
        shouldShowPillAvatar: PropTypes.bool,
    },

    getChildContext: function() {
        return {
            matrixClient: MatrixClientPeg.get(),
        };
    },

    getInitialState() {
        return {
            // The event related to this quote
            event: null,
        };
    },

    componentWillReceiveProps(nextProps) {
        let roomId;
        let prefix;
        let eventId;

        if (nextProps.url) {
            // Default to the empty array if no match for simplicity
            // resource and prefix will be undefined instead of throwing
            const matrixToMatch = REGEX_LOCAL_MATRIXTO.exec(nextProps.url) || [];

            roomId = matrixToMatch[1]; // The room ID
            prefix = matrixToMatch[2]; // The first character of prefix
            eventId = matrixToMatch[3]; // The event ID
        }

        const room = prefix === '#' ?
            MatrixClientPeg.get().getRooms().find((r) => {
                return r.getAliases().includes(roomId);
            }) : MatrixClientPeg.get().getRoom(roomId);

        // Only try and load the event if we know about the room
        // otherwise we just leave a `Quote` anchor which can be used to navigate/join the room manually.
        if (room) this.getEvent(room, eventId);
    },

    componentWillMount() {
        this.componentWillReceiveProps(this.props);
    },

    async getEvent(room, eventId) {
        let event = room.findEventById(eventId);
        if (event) {
            this.setState({room, event});
            return;
        }

        await MatrixClientPeg.get().getEventTimeline(room.getUnfilteredTimelineSet(), eventId);
        event = room.findEventById(eventId);
        this.setState({room, event});
    },

    render: function() {
        const ev = this.state.event;
        if (ev) {
            const EventTile = sdk.getComponent('views.rooms.EventTile');
            return <blockquote>
                <EventTile mxEvent={ev} tileShape="quote" />
            </blockquote>;
        }

        // Deliberately render nothing if the URL isn't recognised
        return <div>
            <a href={this.props.url}>Quote</a>
            <br />
        </div>;
    },
});

export default Quote;
