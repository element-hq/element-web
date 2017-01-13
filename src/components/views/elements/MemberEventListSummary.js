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
        // The maximum number of names to show in either each summary e.g. 2 would result "A, B and 234 others left"
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
            summaryLength: 1,
            threshold: 3,
            avatarsMaxLength: 5,
        };
    },

    _toggleSummary: function() {
        this.setState({
            expanded: !this.state.expanded,
        });
    },

    _renderNameList: function(users) {
        if (users.length === 0) {
            return null;
        }
        let originalNumber = users.length;

        users = users.slice(0, this.props.summaryLength);

        let remaining = originalNumber - this.props.summaryLength;
        if (remaining < 0) {
            remaining = 0;
        }
        let other = " other" + (remaining > 1 ? "s" : "");

        return this._renderCommaSeparatedList(users, remaining) + (remaining ? ' and ' + remaining + other : '');
    },

    // Test whether the first n items repeat for the duration
    // e.g. [1,2,3,4,1,2,3] would resolve true for n = 4
    _isRepeatedSequence: function(transitions, n) {
        let count = 0;
        for (let i = 0; i < transitions.length; i++) {
            if (transitions[i % n] !== transitions[i]) {
                return null;
            }
        }
        return true;
    },

    _renderCommaSeparatedList(items, disableAnd) {
        if (disableAnd) {
            return items.join(', ');
        }
        if (items.length === 0) {
            return "";
        } else if (items.length === 1) {
            return items[0];
        } else {
            let last = items.pop();
            return items.join(', ') + ' and ' + last;
        }
    },

    _getDescriptionForTransition(t, plural) {
        let beConjugated = plural ? "were" : "was";
        let invitation = plural ? "invitations" : "an invitation";

        switch (t) {
            case 'joined':  return "joined";
            case 'left':    return "left";
            case 'invite_reject':     return "rejected " + invitation;
            case 'invite_withdrawal': return "withdrew " + invitation;
            case 'invited':     return beConjugated + " invited";
            case 'banned':      return beConjugated + " banned";
            case 'unbanned':    return beConjugated + " unbanned";
            case 'kicked':      return beConjugated + " kicked";
        }

        return null;
    },

    _renderSummary: function(eventAggregates) {
        let summaries = Object.keys(eventAggregates).map((transitions) => {
            let nameList = this._renderNameList(eventAggregates[transitions]);

            let repeats = 1;
            let repeatExtra = 0;

            let splitTransitions = transitions.split(',');
            let describedTransitions = splitTransitions;
            let plural = eventAggregates[transitions].length > 1;

            for (let modulus = 1; modulus <= 2; modulus++) {
                // Sequences that are repeating through modulus transitions will be truncated
                if (this._isRepeatedSequence(describedTransitions, modulus)) {
                    // Extra repeating sequence on the end that should be treated separately
                    // so as to avoid j,l,j,l,j => "... joined and left 2.5 times"
                    repeatExtra = describedTransitions.length % modulus;

                    repeats = (describedTransitions.length - repeatExtra) / modulus;
                    describedTransitions = describedTransitions.slice(0, modulus);
                    break;
                }
            }

            let numberOfTimes = repeats > 1 ? " " + repeats + " times" : "";

            let descs = describedTransitions.map((t) => {
                return this._getDescriptionForTransition(t, plural);
            });

            let afterRepeatDescs = splitTransitions.slice(splitTransitions.length - repeatExtra).map((t) => {
                return this._getDescriptionForTransition(t, plural);
            });

            let desc = this._renderCommaSeparatedList(descs);
            let afterRepeatDesc = this._renderCommaSeparatedList(afterRepeatDescs);

            return nameList + " " + desc + numberOfTimes + (afterRepeatDesc ? " and then " + afterRepeatDesc : "");
        });

        if (!summaries) {
            return null;
        }

        return (
            <span>
                {summaries.join(", ")}
            </span>
        );
    },

    _renderAvatars: function(roomMembers) {
        let avatars = roomMembers.slice(0, this.props.avatarsMaxLength).map((m) => {
            return (
                <MemberAvatar key={m.userId} member={m} width={14} height={14} />
            );
        });

        return (
            <span>
                {avatars}
            </span>
        );
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        // Update if
        //  - The number of summarised events has changed
        //  - or if the summary is currently expanded
        //  - or if the summary is about to toggle to become collapsed
        //  - or if there are fewEvents, meaning the child eventTiles are shown as-is
        return (
            nextProps.events.length !== this.props.events.length ||
            this.state.expanded || nextState.expanded ||
            nextProps.events.length < this.props.threshold
        );
    },

    _getTransition: function(e) {
        switch (e.getContent().membership) {
            case 'invite': return 'invited';
            case 'ban': return 'banned';
            case 'join': return 'joined';
            case 'leave':
                if (e.getSender() === e.getStateKey()) {
                    switch (e.getPrevContent().membership) {
                        case 'invite':  return 'invite_reject';
                        default:        return 'left';
                    }
                }
                switch (e.getPrevContent().membership) {
                    case 'invite':  return 'invite_withdrawal';
                    case 'ban':     return 'unbanned';
                    case 'join':    return 'kicked';
                    default:        return 'left';
                }
            default: return null;
        }
    },

    _getTransitionSequence: function(events) {
        return events.map(this._getTransition);
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

        // Map user IDs to all of the user's member events in eventsToRender
        let userEvents = {
            // $userId : []
        };
        // Array of userIds ordered by the same ordering as the first event of each user
        let users = [];

        eventsToRender.forEach((e) => {
            const userId = e.getStateKey();
            // Initialise a user's events
            if (!userEvents[userId]) {
                userEvents[userId] = [];
                users.push(userId);
            }
            userEvents[userId].push(e);
        });

        // A map of agregate type to arrays of display names. Each aggregate type
        // is a comma-delimited string of transitions, e.g. "joined,left,kicked".
        // The array of display names is the array of users who went through that
        // sequence during eventsToRender.
        let aggregate = {
            // $aggregateType : []:string
        };
        let avatarMembers = [];

        users.forEach(
            (userId) => {
                let displayName = userEvents[userId][0].getContent().displayname || userId;

                let seq = this._getTransitionSequence(userEvents[userId]);
                if (!aggregate[seq]) {
                    aggregate[seq] = [];
                }

                // Assumes display names are unique
                if (aggregate[seq].indexOf(displayName) === -1) {
                    aggregate[seq].push(displayName);
                }
                avatarMembers.push(userEvents[userId][0].target);
            }
        );

        let avatars = this._renderAvatars(avatarMembers);
        let summary = this._renderSummary(aggregate);
        let toggleButton = (
            <a className="mx_MemberEventListSummary_toggle" onClick={this._toggleSummary}>
                {expanded ? 'collapse' : 'expand'}
            </a>
        );

        let summaryContainer = (
            <div className="mx_EventTile_line">
                <div className="mx_EventTile_info">
                    <span className="mx_MemberEventListSummary_avatars">
                        {avatars}
                    </span>
                    <span className="mx_TextualEvent mx_MemberEventListSummary_summary">
                        {summary}
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
