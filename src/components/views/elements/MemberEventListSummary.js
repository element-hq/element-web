/*
Copyright 2016 OpenMarket Ltd

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
const MemberAvatar = require('../avatars/MemberAvatar.js');

module.exports = React.createClass({
    displayName: 'MemberEventListSummary',

    propTypes: {
        // An array of member events to summarise
        events: React.PropTypes.array.isRequired,
        // An array of EventTiles to render when expanded
        children: React.PropTypes.array.isRequired,
        // The maximum number of names to show in either the join or leave summaries
        summaryLength: React.PropTypes.number,
        // The maximum number of avatars to display in the summary
        avatarsMaxLength: React.PropTypes.number,
        // The minimum number of events needed to trigger summarisation
        threshold: React.PropTypes.number,
    },

    getInitialState: function() {
        return {
            expanded: false,
        };
    },

    getDefaultProps: function() {
        return {
            summaryLength: 3,
            threshold: 3,
            avatarsMaxLength: 5,
        };
    },

    _toggleSummary: function() {
        this.setState({
            expanded: !this.state.expanded,
        });
    },

    _getEventSenderName: function(ev) {
        if (!ev) {
            return 'undefined';
        }
        return ev.sender.name || ev.event.content.displayname || ev.getSender();
    },

    _renderNameList: function(events) {
        if (events.length === 0) {
            return null;
        }
        let originalNumber = events.length;
        events = events.slice(0, this.props.summaryLength);
        let lastEvent = events.pop();

        let names = events.map((ev) => {
            return this._getEventSenderName(ev);
        }).join(', ');

        let lastName = this._getEventSenderName(lastEvent);
        if (names.length === 0) {
            // special-case for a single event
            return lastName;
        }

        let remaining = originalNumber - this.props.summaryLength;
        if (remaining > 0) {
            //  name1, name2, name3, and 100 others
            return names + ', ' + lastName + ', and ' + remaining + ' others';
        } else {
            //  name1, name2 and name3
            return names + ' and ' + lastName;
        }
    },

    _renderSummary: function(joinEvents, leaveEvents) {
        let joiners = this._renderNameList(joinEvents);
        let leavers = this._renderNameList(leaveEvents);

        let joinSummary = null;
        if (joiners) {
            joinSummary = (
                <span>
                    {joiners} joined the room
                </span>
            );
        }
        let leaveSummary = null;
        if (leavers) {
            leaveSummary = (
                <span>
                    {leavers} left the room
                </span>
            );
        }

        // The joinEvents and leaveEvents are representative of the net movement
        // per-user, and so it is possible that the total net movement is nil,
        // whilst there are some events in the expanded list. If the total net
        // movement is nil, then neither joinSummary nor leaveSummary will be
        // truthy, so return null.
        if (!joinSummary && !leaveSummary) {
            return null;
        }

        return (
            <span>
                {joinSummary}{joinSummary && leaveSummary?'; ':''}
                {leaveSummary}.&nbsp;
            </span>
        );
    },

    _renderAvatars: function(events) {
        let avatars = events.slice(0, this.props.avatarsMaxLength).map((e) => {
            return (
                <MemberAvatar
                    key={e.getId()}
                    member={e.sender}
                    width={14}
                    height={14}
                />
            );
        });

        return (
            <span>
                {avatars}
            </span>
        );
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        return (
            nextProps.events.length !== this.props.events.length ||
            nextState.expanded !== this.state.expanded
        );
    },

    render: function() {
        let eventsToRender = this.props.events;
        let fewEvents = eventsToRender.length < this.props.threshold;
        let expanded = this.state.expanded || fewEvents;

        let expandedEvents = null;
        if (expanded) {
            expandedEvents = this.props.children;
        }

        if (fewEvents) {
            return (
                <div className="mx_MemberEventListSummary">
                    {expandedEvents}
                </div>
            );
        }

        // Map user IDs to the first and last member events in eventsToRender for each user
        let userEvents = {
            // $userId : {first : e0, last : e1}
        };

        eventsToRender.forEach((e) => {
            const userId = e.getSender();
            // Initialise a user's events
            if (!userEvents[userId]) {
                userEvents[userId] = {first: null, last: null};
            }
            if (!userEvents[userId].first) {
                userEvents[userId].first = e;
            }
            userEvents[userId].last = e;
        });

        // Populate the join/leave event arrays with events that represent what happened
        // overall to a user's membership. If no events are added to either array for a
        // particular user, they will be considered a user that "joined and left".
        let joinEvents = [];
        let leaveEvents = [];
        let joinedAndLeft = 0;
        let senders = Object.keys(userEvents);
        senders.forEach(
            (userId) => {
                let firstEvent = userEvents[userId].first;
                let lastEvent = userEvents[userId].last;

                // Membership BEFORE eventsToRender
                let previousMembership = firstEvent.getPrevContent().membership || "leave";

                // If the last membership event differs from previousMembership, use that.
                if (previousMembership !== lastEvent.getContent().membership) {
                    if (lastEvent.event.content.membership === 'join') {
                        joinEvents.push(lastEvent);
                    } else if (lastEvent.event.content.membership === 'leave') {
                        leaveEvents.push(lastEvent);
                    }
                } else {
                    // Increment the number of users whose membership change was nil overall
                    joinedAndLeft++;
                }
            }
        );

        let avatars = this._renderAvatars(joinEvents.concat(leaveEvents));
        let summary = this._renderSummary(joinEvents, leaveEvents);
        let toggleButton = (
            <a className="mx_MemberEventListSummary_toggle" onClick={this._toggleSummary}>
                {expanded ? 'collapse' : 'expand'}
            </a>
        );
        let plural = (joinEvents.length + leaveEvents.length > 0) ? 'others' : 'users';
        let noun = (joinedAndLeft === 1 ? 'user' : plural);

        let summaryContainer = (
            <div className="mx_EventTile_line">
                <div className="mx_EventTile_info">
                    <span className="mx_MemberEventListSummary_avatars">
                        {avatars}
                    </span>
                    <span className="mx_TextualEvent mx_MemberEventListSummary_summary">
                        {summary}{joinedAndLeft ? joinedAndLeft + ' ' + noun + ' joined and left' : ''}
                    </span>&nbsp;
                    {toggleButton}
                </div>
            </div>
        );

        return (
            <div className="mx_MemberEventListSummary">
                {summaryContainer}
                {expandedEvents}
            </div>
        );
    },
});
