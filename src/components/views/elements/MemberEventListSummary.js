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
        // Called when the MELS expansion is toggled
        onToggle: React.PropTypes.func,
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
        this.props.onToggle();
    },

    /**
     * Render the JSX for users aggregated by their transition sequences (`eventAggregates`) where
     * the sequences are ordered by `orderedTransitionSequences`.
     * @param {object[]} eventAggregates a map of transition sequence to array of user display names
     * or user IDs.
     * @param {string[]} orderedTransitionSequences an array which is some ordering of
     * `Object.keys(eventAggregates)`.
     * @returns {ReactElement} a single <span> containing the textual summary of the aggregated
     * events that occurred.
     */
    _renderSummary: function(eventAggregates, orderedTransitionSequences) {
        const summaries = orderedTransitionSequences.map((transitions) => {
            const userNames = eventAggregates[transitions];
            const nameList = this._renderNameList(userNames);
            const plural = userNames.length > 1;

            const splitTransitions = transitions.split(',');

            // Some neighbouring transitions are common, so canonicalise some into "pair"
            // transitions
            const canonicalTransitions = this._getCanonicalTransitions(splitTransitions);
            // Transform into consecutive repetitions of the same transition (like 5
            // consecutive 'joined_and_left's)
            const coalescedTransitions = this._coalesceRepeatedTransitions(
                canonicalTransitions
            );

            const descs = coalescedTransitions.map((t) => {
                return this._getDescriptionForTransition(
                    t.transitionType, plural, t.repeats
                );
            });

            const desc = this._renderCommaSeparatedList(descs);

            return nameList + " " + desc;
        });

        if (!summaries) {
            return null;
        }

        return (
            <span className="mx_TextualEvent mx_MemberEventListSummary_summary">
                {summaries.join(", ")}
            </span>
        );
    },

    /**
     * @param {string[]} users an array of user display names or user IDs.
     * @returns {string} a comma-separated list that ends with "and [n] others" if there are
     * more items in `users` than `this.props.summaryLength`, which is the number of names
     * included before "and [n] others".
     */
    _renderNameList: function(users) {
        return this._renderCommaSeparatedList(users, this.props.summaryLength);
    },

    /**
     * Canonicalise an array of transitions such that some pairs of transitions become
     * single transitions. For example an input ['joined','left'] would result in an output
     * ['joined_and_left'].
     * @param {string[]} transitions an array of transitions.
     * @returns {string[]} an array of transitions.
     */
    _getCanonicalTransitions: function(transitions) {
        const modMap = {
            'joined': {
                'after': 'left',
                'newTransition': 'joined_and_left',
            },
            'left': {
                'after': 'joined',
                'newTransition': 'left_and_joined',
            },
            // $currentTransition : {
            //     'after' : $nextTransition,
            //     'newTransition' : 'new_transition_type',
            // },
        };
        const res = [];

        for (let i = 0; i < transitions.length; i++) {
            const t = transitions[i];
            const t2 = transitions[i + 1];

            let transition = t;

            if (i < transitions.length - 1 && modMap[t] && modMap[t].after === t2) {
                transition = modMap[t].newTransition;
                i++;
            }

            res.push(transition);
        }
        return res;
    },

    /**
     * Transform an array of transitions into an array of transitions and how many times
     * they are repeated consecutively.
     *
     * An array of 123 "joined_and_left" transitions, would result in:
     * ```
     * [{
     *   transitionType: "joined_and_left"
     *   repeats: 123
     * }]
     * ```
     * @param {string[]} transitions the array of transitions to transform.
     * @returns {object[]} an array of coalesced transitions.
     */
    _coalesceRepeatedTransitions: function(transitions) {
        const res = [];
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
        return res;
    },

    /**
     * For a certain transition, t, describe what happened to the users that
     * underwent the transition.
     * @param {string} t the transition type.
     * @param {boolean} plural whether there were multiple users undergoing the same
     * transition.
     * @param {number} repeats the number of times the transition was repeated in a row.
     * @returns {string} the written English equivalent of the transition.
     */
    _getDescriptionForTransition(t, plural, repeats) {
        const beConjugated = plural ? "were" : "was";
        const invitation = "their invitation" + (plural || (repeats > 1) ? "s" : "");

        let res = null;
        const map = {
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
            "changed_name": "changed name",
            "changed_avatar": "changed avatar",
        };

        if (Object.keys(map).includes(t)) {
            res = map[t] + (repeats > 1 ? " " + repeats + " times" : "" );
        }

        return res;
    },

    /**
     * Constructs a written English string representing `items`, with an optional limit on
     * the number of items included in the result. If specified and if the length of
     *`items` is greater than the limit, the string "and n others" will be appended onto
     * the result.
     * If `items` is empty, returns the empty string. If there is only one item, return
     * it.
     * @param {string[]} items the items to construct a string from.
     * @param {number?} itemLimit the number by which to limit the list.
     * @returns {string} a string constructed by joining `items` with a comma between each
     * item, but with the last item appended as " and [lastItem]".
     */
    _renderCommaSeparatedList(items, itemLimit) {
        const remaining = itemLimit === undefined ? 0 : Math.max(
            items.length - itemLimit, 0
        );
        if (items.length === 0) {
            return "";
        } else if (items.length === 1) {
            return items[0];
        } else if (remaining) {
            items = items.slice(0, itemLimit);
            const other = " other" + (remaining > 1 ? "s" : "");
            return items.join(', ') + ' and ' + remaining + other;
        } else {
            const lastItem = items.pop();
            return items.join(', ') + ' and ' + lastItem;
        }
    },

    _renderAvatars: function(roomMembers) {
        const avatars = roomMembers.slice(0, this.props.avatarsMaxLength).map((m) => {
            return (
                <MemberAvatar key={m.userId} member={m} width={14} height={14} />
            );
        });
        return (
            <span className="mx_MemberEventListSummary_avatars">
                {avatars}
            </span>
        );
    },

    _getTransitionSequence: function(events) {
        return events.map(this._getTransition);
    },

    /**
     * Label a given membership event, `e`, where `getContent().membership` has
     * changed for each transition allowed by the Matrix protocol. This attempts to
     * label the membership changes that occur in `../../../TextForEvent.js`.
     * @param {MatrixEvent} e the membership change event to label.
     * @returns {string?} the transition type given to this event. This defaults to `null`
     * if a transition is not recognised.
     */
    _getTransition: function(e) {
        switch (e.mxEvent.getContent().membership) {
            case 'invite': return 'invited';
            case 'ban': return 'banned';
            case 'join':
                if (e.mxEvent.getPrevContent().membership === 'join') {
                    if (e.mxEvent.getContent().displayname !==
                        e.mxEvent.getPrevContent().displayname)
                    {
                        return 'changed_name';
                    }
                    else if (e.mxEvent.getContent().avatar_url !==
                        e.mxEvent.getPrevContent().avatar_url)
                    {
                        return 'changed_avatar';
                    }
                    // console.log("MELS ignoring duplicate membership join event");
                    return null;
                }
                else {
                    return 'joined';
                }
            case 'leave':
                if (e.mxEvent.getSender() === e.mxEvent.getStateKey()) {
                    switch (e.mxEvent.getPrevContent().membership) {
                        case 'invite': return 'invite_reject';
                        default: return 'left';
                    }
                }
                switch (e.mxEvent.getPrevContent().membership) {
                    case 'invite': return 'invite_withdrawal';
                    case 'ban': return 'unbanned';
                    case 'join': return 'kicked';
                    default: return 'left';
                }
            default: return null;
        }
    },

    _getAggregate: function(userEvents) {
        // A map of aggregate type to arrays of display names. Each aggregate type
        // is a comma-delimited string of transitions, e.g. "joined,left,kicked".
        // The array of display names is the array of users who went through that
        // sequence during eventsToRender.
        const aggregate = {
            // $aggregateType : []:string
        };
        // A map of aggregate types to the indices that order them (the index of
        // the first event for a given transition sequence)
        const aggregateIndices = {
            // $aggregateType : int
        };

        const users = Object.keys(userEvents);
        users.forEach(
            (userId) => {
                const firstEvent = userEvents[userId][0];
                const displayName = firstEvent.displayName;

                const seq = this._getTransitionSequence(userEvents[userId]);
                if (!aggregate[seq]) {
                    aggregate[seq] = [];
                    aggregateIndices[seq] = -1;
                }

                aggregate[seq].push(displayName);

                if (aggregateIndices[seq] === -1 ||
                    firstEvent.index < aggregateIndices[seq]) {
                        aggregateIndices[seq] = firstEvent.index;
                }
            }
        );

        return {
            names: aggregate,
            indices: aggregateIndices,
        };
    },

    render: function() {
        const eventsToRender = this.props.events;
        const fewEvents = eventsToRender.length < this.props.threshold;
        const expanded = this.state.expanded || fewEvents;

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

        // Map user IDs to an array of objects:
        const userEvents = {
            // $userId : [{
            //     // The original event
            //     mxEvent: e,
            //     // The display name of the user (if not, then user ID)
            //     displayName: e.target.name || userId,
            //     // The original index of the event in this.props.events
            //     index: index,
            // }]
        };

        const avatarMembers = [];
        eventsToRender.forEach((e, index) => {
            const userId = e.getStateKey();
            // Initialise a user's events
            if (!userEvents[userId]) {
                userEvents[userId] = [];
                if (e.target) avatarMembers.push(e.target);
            }
            userEvents[userId].push({
                mxEvent: e,
                displayName: (e.target ? e.target.name : null) || userId,
                index: index,
            });
        });

        const aggregate = this._getAggregate(userEvents);

        // Sort types by order of lowest event index within sequence
        const orderedTransitionSequences = Object.keys(aggregate.names).sort(
            (seq1, seq2) => aggregate.indices[seq1] > aggregate.indices[seq2]
        );

        let summaryContainer = null;
        if (!expanded) {
            summaryContainer = (
                <div className="mx_EventTile_line">
                    <div className="mx_EventTile_info">
                        {this._renderAvatars(avatarMembers)}
                        {this._renderSummary(aggregate.names, orderedTransitionSequences)}
                    </div>
                </div>
            );
        }
        const toggleButton = (
            <div className={"mx_MemberEventListSummary_toggle"} onClick={this._toggleSummary}>
                {expanded ? 'collapse' : 'expand'}
            </div>
        );

        return (
            <div className="mx_MemberEventListSummary">
                {toggleButton}
                {summaryContainer}
                {expanded ? <div className="mx_MemberEventListSummary_line">&nbsp;</div> : null}
                {expandedEvents}
            </div>
        );
    },
});
