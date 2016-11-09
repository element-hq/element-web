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
const React = require('react');
const MemberAvatar = require('../avatars/MemberAvatar.js');
const dispatcher = require("../../../dispatcher");

module.exports = React.createClass({
    displayName: 'MemberEventListSummary',

    propTypes: {
        // An array of member events to summarise
        events: React.PropTypes.array,
        // The maximum number of names to show in either the join or leave summaries
        summaryLength: React.PropTypes.number,
        // The maximum number of avatars to display in the summary
        avatarsMaxLength: React.PropTypes.number,
        // The minimum number of events needed to trigger summarisation
        threshold: React.PropTypes.number,
        // The function to render events if they are not being summarised
        renderEvents: React.PropTypes.function,
        previousEvent: React.PropTypes.object,
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
            avatarsMaxLength: 5
        };
    },

    toggleSummary: function() {
        this.setState({
            expanded: !this.state.expanded,
        });
    },

    getEventSenderName: function(ev) {
        if (!ev) {
            return 'undefined';
        }
        return ev.sender.name || ev.event.content.displayname || ev.getSender();
    },

    renderNameList: function(events) {
        if (events.length === 0) {
            return null;
        }
        let originalNumber = events.length;
        events = events.slice(0, this.props.summaryLength);
        let lastEvent = events.pop();

        let names = events.map((ev) => {
            return this.getEventSenderName(ev);
        }).join(', ');

        if (names.length === 0) {
            return this.getEventSenderName(lastEvent);
        }

        // Special case the last name. ' and ' might be included later
        // So you have two cases:
        if (originalNumber <= this.props.summaryLength) {
            // name1, name2 and name3
            names += ' and ';
        } else {
            // name1, name2, name3 [and 100 others]
            names += ', ';
        }
        return names + this.getEventSenderName(lastEvent);
    },

    renderSummary: function(joinEvents, leaveEvents) {
        let joiners = this.renderNameList(joinEvents);
        let remainingJoiners = joinEvents.length - this.props.summaryLength;

        let leavers = this.renderNameList(leaveEvents);
        let remainingLeavers = leaveEvents.length - this.props.summaryLength;

        let joinSummary = null;

        if (joiners) {
            joinSummary = (
                <span>
                    {joiners} {remainingJoiners > 0 ? 'and ' + remainingJoiners + ' others ':''}joined the room
                </span>
            );
        }

        let leaveSummary = '';

        if (leavers) {
            leaveSummary = (
                <span>
                    {leavers} {remainingLeavers > 0 ? 'and ' + remainingLeavers + ' others ':''}left the room
                </span>
            );
        }

        return (
            <span>
                {joinSummary}{joinSummary && leaveSummary?'; ':''}
                {leaveSummary}
            </span>
        );
    },



    renderAvatars: function(events) {

        let avatars = events.slice(0, this.props.avatarsMaxLength).map((e) => {
            let onClickAvatar = () => {
                dispatcher.dispatch({
                    action: 'view_user',
                    member: e.sender,
                });
            };
            return (
                <MemberAvatar
                    key={e.getId()}
                    member={e.sender}
                    width={14}
                    height={14}
                    onClick={onClickAvatar}
                />
            );
        });

        return (
            <span>
                {avatars}
            </span>
        );
    },

    render: function() {
        let summary = null;

        // Reorder events so that joins come before leaves
        let eventsToRender = this.props.events;

        // Filter out those who joined, then left
        let filteredEvents = eventsToRender.filter(
            (e) => {
                return eventsToRender.filter(
                    (e2) => {
                        return e.getSender() === e2.getSender()
                            && e.event.content.membership !== e2.event.content.membership;
                    }
                ).length === 0;
            }
        );

        let joinAndLeft = (eventsToRender.length - filteredEvents.length) / 2;
        if (joinAndLeft <= 0 || joinAndLeft % 1 !== 0) {
            joinAndLeft = null;
        }

        let joinEvents = filteredEvents.filter((ev) => {
            return ev.event.content.membership === 'join';
        });

        let leaveEvents = filteredEvents.filter((ev) => {
            return ev.event.content.membership === 'leave';
        });

        let fewEvents = eventsToRender.length < this.props.threshold;
        console.log(eventsToRender.length, joinEvents.length, leaveEvents.length, this.state.expanded, fewEvents);

        let expanded = this.state.expanded || fewEvents;
        let expandedEvents = null;

        if (expanded) {
            expandedEvents = this.props.renderEvents(this.props.previousEvent, eventsToRender);
        }

        let avatars = this.renderAvatars(joinEvents.concat(leaveEvents));

        let toggleButton = null;
        let summaryContainer = null;
        if (!fewEvents) {
            summary = this.renderSummary(joinEvents, leaveEvents);
            toggleButton = (
                <a onClick={this.toggleSummary} href="javascript:;">{expanded?'collapse':'expand'}</a>
            );

            summaryContainer = (
                <div className="mx_EventTile_line">
                    <div className="mx_EventTile_info">
                        <span className="mx_MemberEventListSummary_avatars">
                            {avatars}
                        </span>
                        <span className="mx_TextualEvent mx_MemberEventListSummary_summary">
                            {summary}{joinAndLeft? '. ' + joinAndLeft + ' others joined and left' : ''}
                        </span>&nbsp;
                        {toggleButton}
                    </div>
                </div>
            );
        }

        return (
            <div className="mx_MemberEventListSummary">
                {summaryContainer}
                {expandedEvents}
            </div>
        );
    },
});
