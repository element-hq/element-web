/*
Copyright 2016 OpenMarket Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';
import { formatCommaSeparatedList } from '../../../utils/FormattingUtils';
import * as sdk from "../../../index";
import {MatrixEvent} from "matrix-js-sdk";
import {isValid3pidInvite} from "../../../RoomInvite";

export default class MemberEventListSummary extends React.Component {
    static propTypes = {
        // An array of member events to summarise
        events: PropTypes.arrayOf(PropTypes.instanceOf(MatrixEvent)).isRequired,
        // An array of EventTiles to render when expanded
        children: PropTypes.array.isRequired,
        // The maximum number of names to show in either each summary e.g. 2 would result "A, B and 234 others left"
        summaryLength: PropTypes.number,
        // The maximum number of avatars to display in the summary
        avatarsMaxLength: PropTypes.number,
        // The minimum number of events needed to trigger summarisation
        threshold: PropTypes.number,
        // Called when the MELS expansion is toggled
        onToggle: PropTypes.func,
        // Whether or not to begin with state.expanded=true
        startExpanded: PropTypes.bool,
    };

    static defaultProps = {
        summaryLength: 1,
        threshold: 3,
        avatarsMaxLength: 5,
    };

    shouldComponentUpdate(nextProps) {
        // Update if
        //  - The number of summarised events has changed
        //  - or if the summary is about to toggle to become collapsed
        //  - or if there are fewEvents, meaning the child eventTiles are shown as-is
        return (
            nextProps.events.length !== this.props.events.length ||
            nextProps.events.length < this.props.threshold
        );
    }

    /**
     * Generate the text for users aggregated by their transition sequences (`eventAggregates`) where
     * the sequences are ordered by `orderedTransitionSequences`.
     * @param {object[]} eventAggregates a map of transition sequence to array of user display names
     * or user IDs.
     * @param {string[]} orderedTransitionSequences an array which is some ordering of
     * `Object.keys(eventAggregates)`.
     * @returns {string} the textual summary of the aggregated events that occurred.
     */
    _generateSummary(eventAggregates, orderedTransitionSequences) {
        const summaries = orderedTransitionSequences.map((transitions) => {
            const userNames = eventAggregates[transitions];
            const nameList = this._renderNameList(userNames);

            const splitTransitions = transitions.split(',');

            // Some neighbouring transitions are common, so canonicalise some into "pair"
            // transitions
            const canonicalTransitions = this._getCanonicalTransitions(splitTransitions);
            // Transform into consecutive repetitions of the same transition (like 5
            // consecutive 'joined_and_left's)
            const coalescedTransitions = this._coalesceRepeatedTransitions(
                canonicalTransitions,
            );

            const descs = coalescedTransitions.map((t) => {
                return this._getDescriptionForTransition(
                    t.transitionType, userNames.length, t.repeats,
                );
            });

            const desc = formatCommaSeparatedList(descs);

            return _t('%(nameList)s %(transitionList)s', { nameList: nameList, transitionList: desc });
        });

        if (!summaries) {
            return null;
        }

        return summaries.join(", ");
    }

    /**
     * @param {string[]} users an array of user display names or user IDs.
     * @returns {string} a comma-separated list that ends with "and [n] others" if there are
     * more items in `users` than `this.props.summaryLength`, which is the number of names
     * included before "and [n] others".
     */
    _renderNameList(users) {
        return formatCommaSeparatedList(users, this.props.summaryLength);
    }

    /**
     * Canonicalise an array of transitions such that some pairs of transitions become
     * single transitions. For example an input ['joined','left'] would result in an output
     * ['joined_and_left'].
     * @param {string[]} transitions an array of transitions.
     * @returns {string[]} an array of transitions.
     */
    _getCanonicalTransitions(transitions) {
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
    }

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
    _coalesceRepeatedTransitions(transitions) {
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
    }

    /**
     * For a certain transition, t, describe what happened to the users that
     * underwent the transition.
     * @param {string} t the transition type.
     * @param {number} userCount number of usernames
     * @param {number} repeats the number of times the transition was repeated in a row.
     * @returns {string} the written Human Readable equivalent of the transition.
     */
    _getDescriptionForTransition(t, userCount, repeats) {
        // The empty interpolations 'severalUsers' and 'oneUser'
        // are there only to show translators to non-English languages
        // that the verb is conjugated to plural or singular Subject.
        let res = null;
        switch (t) {
            case "joined":
                res = (userCount > 1)
                    ? _t("%(severalUsers)sjoined %(count)s times", { severalUsers: "", count: repeats })
                    : _t("%(oneUser)sjoined %(count)s times", { oneUser: "", count: repeats });
                break;
            case "left":
                res = (userCount > 1)
                    ? _t("%(severalUsers)sleft %(count)s times", { severalUsers: "", count: repeats })
                    : _t("%(oneUser)sleft %(count)s times", { oneUser: "", count: repeats });
                break;
            case "joined_and_left":
                res = (userCount > 1)
                    ? _t("%(severalUsers)sjoined and left %(count)s times", { severalUsers: "", count: repeats })
                    : _t("%(oneUser)sjoined and left %(count)s times", { oneUser: "", count: repeats });
                break;
            case "left_and_joined":
                res = (userCount > 1)
                    ? _t("%(severalUsers)sleft and rejoined %(count)s times", { severalUsers: "", count: repeats })
                    : _t("%(oneUser)sleft and rejoined %(count)s times", { oneUser: "", count: repeats });
                break;
            case "invite_reject":
                res = (userCount > 1)
                    ? _t("%(severalUsers)srejected their invitations %(count)s times", { severalUsers: "", count: repeats })
                    : _t("%(oneUser)srejected their invitation %(count)s times", { oneUser: "", count: repeats });
                break;
            case "invite_withdrawal":
                res = (userCount > 1)
                    ? _t("%(severalUsers)shad their invitations withdrawn %(count)s times", { severalUsers: "", count: repeats })
                    : _t("%(oneUser)shad their invitation withdrawn %(count)s times", { oneUser: "", count: repeats });
                break;
            case "invited":
                res = (userCount > 1)
                    ? _t("were invited %(count)s times", { count: repeats })
                    : _t("was invited %(count)s times", { count: repeats });
                break;
            case "banned":
                res = (userCount > 1)
                    ? _t("were banned %(count)s times", { count: repeats })
                    : _t("was banned %(count)s times", { count: repeats });
                break;
            case "unbanned":
                res = (userCount > 1)
                    ? _t("were unbanned %(count)s times", { count: repeats })
                    : _t("was unbanned %(count)s times", { count: repeats });
                break;
            case "kicked":
                res = (userCount > 1)
                    ? _t("were kicked %(count)s times", { count: repeats })
                    : _t("was kicked %(count)s times", { count: repeats });
                break;
            case "changed_name":
                res = (userCount > 1)
                    ? _t("%(severalUsers)schanged their name %(count)s times", { severalUsers: "", count: repeats })
                    : _t("%(oneUser)schanged their name %(count)s times", { oneUser: "", count: repeats });
                break;
            case "changed_avatar":
                res = (userCount > 1)
                    ? _t("%(severalUsers)schanged their avatar %(count)s times", { severalUsers: "", count: repeats })
                    : _t("%(oneUser)schanged their avatar %(count)s times", { oneUser: "", count: repeats });
                break;
            case "no_change":
                res = (userCount > 1)
                    ? _t("%(severalUsers)smade no changes %(count)s times", { severalUsers: "", count: repeats })
                    : _t("%(oneUser)smade no changes %(count)s times", { oneUser: "", count: repeats });
                break;
        }

        return res;
    }

    _getTransitionSequence(events) {
        return events.map(this._getTransition);
    }

    /**
     * Label a given membership event, `e`, where `getContent().membership` has
     * changed for each transition allowed by the Matrix protocol. This attempts to
     * label the membership changes that occur in `../../../TextForEvent.js`.
     * @param {MatrixEvent} e the membership change event to label.
     * @returns {string?} the transition type given to this event. This defaults to `null`
     * if a transition is not recognised.
     */
    _getTransition(e) {
        if (e.mxEvent.getType() === 'm.room.third_party_invite') {
            // Handle 3pid invites the same as invites so they get bundled together
            if (!isValid3pidInvite(e.mxEvent)) {
                return 'invite_withdrawal';
            }
            return 'invited';
        }

        switch (e.mxEvent.getContent().membership) {
            case 'invite': return 'invited';
            case 'ban': return 'banned';
            case 'join':
                if (e.mxEvent.getPrevContent().membership === 'join') {
                    if (e.mxEvent.getContent().displayname !==
                        e.mxEvent.getPrevContent().displayname) {
                        return 'changed_name';
                    } else if (e.mxEvent.getContent().avatar_url !==
                        e.mxEvent.getPrevContent().avatar_url) {
                        return 'changed_avatar';
                    }
                    // console.log("MELS ignoring duplicate membership join event");
                    return 'no_change';
                } else {
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
                    // sender is not target and made the target leave, if not from invite/ban then this is a kick
                    default: return 'kicked';
                }
            default: return null;
        }
    }

    _getAggregate(userEvents) {
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
            },
        );

        return {
            names: aggregate,
            indices: aggregateIndices,
        };
    }

    render() {
        const eventsToRender = this.props.events;

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

            let displayName = userId;
            if (e.getType() === 'm.room.third_party_invite') {
                displayName = e.getContent().display_name;
            } else if (e.target) {
                displayName = e.target.name;
            }

            userEvents[userId].push({
                mxEvent: e,
                displayName,
                index: index,
            });
        });

        const aggregate = this._getAggregate(userEvents);

        // Sort types by order of lowest event index within sequence
        const orderedTransitionSequences = Object.keys(aggregate.names).sort(
            (seq1, seq2) => aggregate.indices[seq1] > aggregate.indices[seq2],
        );

        const EventListSummary = sdk.getComponent("views.elements.EventListSummary");
        return <EventListSummary
            events={this.props.events}
            threshold={this.props.threshold}
            onToggle={this.props.onToggle}
            startExpanded={this.props.startExpanded}
            children={this.props.children}
            summaryMembers={avatarMembers}
            summaryText={this._generateSummary(aggregate.names, orderedTransitionSequences)} />;
    }
}
