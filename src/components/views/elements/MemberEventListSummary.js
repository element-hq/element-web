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

    _toggleSummary: function() {
        this.setState({
            expanded: !this.state.expanded,
        });
    },

    _renderNameList: function(users) {
        return this._renderCommaSeparatedList(users, this.props.summaryLength);
    },

    _renderSummary: function(eventAggregates, orderedTransitionSequences) {
        let summaries = orderedTransitionSequences.map((transitions) => {
            let nameList = this._renderNameList(eventAggregates[transitions]);
            let plural = eventAggregates[transitions].length > 1;

            let splitTransitions = transitions.split(',');

            // Some pairs of transitions are common and are repeated a lot, so canonicalise them into "pair" transitions
            let canonicalTransitions = this._getCanonicalTransitions(splitTransitions);
            // Remove consecutive repetitions of the same transition (like 5 consecutive 'join_and_leave's)
            let truncatedTransitions = this._getTruncatedTransitions(canonicalTransitions);

            let descs = truncatedTransitions.map((t) => {
                return this._getDescriptionForTransition(t.transitionType, plural, t.repeats);
            });

            let desc = this._renderCommaSeparatedList(descs);

            return nameList + " " + desc;
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

    _renderNameList: function(users) {
        if (users.length === 0) {
            return null;
        }

        return this._renderCommaSeparatedList(users, this.props.summaryLength);
    },

    _getCanonicalTransitions: function(transitions) {
        let modMap = {
            'joined' : {
                'after' : 'left',
                'newTransition' : 'joined_and_left',
            },
            'left' : {
                'after' : 'joined',
                'newTransition' : 'left_and_joined',
            },
            // $currentTransition : {
            //     'after' : $nextTransition,
            //     'newTransition' : 'new_transition_type',
            // },
        };
        const res = [];

        for (let i = 0; i < transitions.length; i++) {
            let t = transitions[i];
            let t2 = transitions[i + 1];

            let transition = t;

            if (i < transitions.length - 1 && modMap[t] && modMap[t].after === t2) {
                transition = modMap[t].newTransition;
                i++;
            }

            res.push(transition);
        }
        return res;
    },

    _getTruncatedTransitions: function(transitions) {
        let res = [];
        for (let i = 0; i < transitions.length; i++) {
            if (res.length > 0 && res[res.length - 1].transitionType === transitions[i]) {
                res[res.length - 1].repeats += 1;
            } else {
                res.push({
                    transitionType: transitions[i],
                    repeats: 1,
                });
            }
        }
        // returns [{
        //     transitionType: "joined_and_left"
        //     repeats: 123
        // }, ... ]
        return res;
    },

    /**
     * For a certain transition, t, describe what happened to the users that
     * underwent the transition.
     * @param {string} t the transition type
     * @param {boolean} plural whether there were multiple users undergoing the same transition
     * @param {number} repeats the number of times the transition was repeated in a row
     * @returns {string} the spoken English equivalent of the transition
     */
    _getDescriptionForTransition(t, plural, repeats) {
        let beConjugated = plural ? "were" : "was";
        let invitation = "their invitation" + (plural || (repeats > 1) ? "s" : "");

        let res = null;
        let map = {
            "joined": "joined",
            "left": "left",
            "joined_and_left": "joined and left",
            "left_and_joined": "left and rejoined",
            "invite_reject": "rejected " + invitation,
            "invite_withdrawal": "had " + invitation + " withdrawn",
            "invited": beConjugated + " invited",
            "banned": beConjugated + " banned",
            "unbanned": beConjugated + " unbanned",
            "kicked": beConjugated + " kicked",
        };

        if (Object.keys(map).includes(t)) {
            res = map[t] + (repeats > 1 ? " " + repeats + " times" : "" );
        }

        return res;
    },

    _renderCommaSeparatedList(items, itemLimit) {
        const remaining = itemLimit === undefined ? 0 : Math.max(items.length - itemLimit, 0);
        if (items.length === 0) {
            return "";
        } else if (items.length === 1) {
            return items[0];
        } else if (remaining) {
            items = items.slice(0, itemLimit);
            const other = " other" + (remaining > 1 ? "s" : "");
            return items.join(', ') + ' and ' + remaining + other;
        } else {
            let last = items.pop();
            return items.join(', ') + ' and ' + last;
        }
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

    _getTransitionSequence: function(events) {
        return events.map(this._getTransition);
    },

    _getTransition: function(e) {
        switch (e.mxEvent.getContent().membership) {
            case 'invite': return 'invited';
            case 'ban': return 'banned';
            case 'join': return 'joined';
            case 'leave':
                if (e.mxEvent.getSender() === e.mxEvent.getStateKey()) {
                    switch (e.mxEvent.getPrevContent().membership) {
                        case 'invite':  return 'invite_reject';
                        default:        return 'left';
                    }
                }
                switch (e.mxEvent.getPrevContent().membership) {
                    case 'invite':  return 'invite_withdrawal';
                    case 'ban':     return 'unbanned';
                    case 'join':    return 'kicked';
                    default:        return 'left';
                }
            default: return null;
        }
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

        eventsToRender.forEach((e, index) => {
            const userId = e.getStateKey();
            // Initialise a user's events
            if (!userEvents[userId]) {
                userEvents[userId] = [];
            }
            userEvents[userId].push({
                mxEvent: e,
                displayName: e.target.name || userId,
                index: index,
            });
        });

        // A map of aggregate type to arrays of display names. Each aggregate type
        // is a comma-delimited string of transitions, e.g. "joined,left,kicked".
        // The array of display names is the array of users who went through that
        // sequence during eventsToRender.
        let aggregate = {
            // $aggregateType : []:string
        };
        // A map of aggregate types to the indices that order them (the index of
        // the first event for a given transition sequence)
        let aggregateIndices = {
            // $aggregateType : int
        };

        let avatarMembers = [];

        let users = Object.keys(userEvents);
        users.forEach(
            (userId) => {
                let firstEvent = userEvents[userId][0];
                let displayName = firstEvent.displayName;

                let seq = this._getTransitionSequence(userEvents[userId]);
                if (!aggregate[seq]) {
                    aggregate[seq] = [];
                    aggregateIndices[seq] = -1;
                }

                if (aggregate[seq].indexOf(displayName) === -1) {
                    aggregate[seq].push(displayName);
                }

                if (aggregateIndices[seq] === -1 || firstEvent.index < aggregateIndices[seq]) {
                    aggregateIndices[seq] = firstEvent.index;
                }

                avatarMembers.push(firstEvent.mxEvent.target);
            }
        );

        // Sort types by order of lowest event index within sequence
        let orderedTransitionSequences = Object.keys(aggregate).sort((seq1, seq2) => aggregateIndices[seq1] > aggregateIndices[seq2]);

        let avatars = this._renderAvatars(avatarMembers);
        let summary = this._renderSummary(aggregate, orderedTransitionSequences);
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
