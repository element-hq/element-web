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

import React, { ComponentProps, ReactNode } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { EventType } from "matrix-js-sdk/src/@types/event";

import { _t } from "../../../languageHandler";
import { formatCommaSeparatedList } from "../../../utils/FormattingUtils";
import { isValid3pidInvite } from "../../../RoomInvite";
import GenericEventListSummary from "./GenericEventListSummary";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { jsxJoin } from "../../../utils/ReactUtils";
import { Layout } from "../../../settings/enums/Layout";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import AccessibleButton from "./AccessibleButton";
import RoomContext from "../../../contexts/RoomContext";

const onPinnedMessagesClick = (): void => {
    RightPanelStore.instance.setCard({ phase: RightPanelPhases.PinnedMessages }, false);
};

const TARGET_AS_DISPLAY_NAME_EVENTS = [EventType.RoomMember];

interface IProps extends Omit<ComponentProps<typeof GenericEventListSummary>, "summaryText" | "summaryMembers"> {
    // The maximum number of names to show in either each summary e.g. 2 would result "A, B and 234 others left"
    summaryLength?: number;
    // The maximum number of avatars to display in the summary
    avatarsMaxLength?: number;
    // The currently selected layout
    layout: Layout;
}

interface IUserEvents {
    // The original event
    mxEvent: MatrixEvent;
    // The display name of the user (if not, then user ID)
    displayName: string;
    // The original index of the event in this.props.events
    index: number;
}

enum TransitionType {
    Joined = "joined",
    Left = "left",
    JoinedAndLeft = "joined_and_left",
    LeftAndJoined = "left_and_joined",
    InviteReject = "invite_reject",
    InviteWithdrawal = "invite_withdrawal",
    Invited = "invited",
    Banned = "banned",
    Unbanned = "unbanned",
    Kicked = "kicked",
    ChangedName = "changed_name",
    ChangedAvatar = "changed_avatar",
    NoChange = "no_change",
    ServerAcl = "server_acl",
    ChangedPins = "pinned_messages",
    MessageRemoved = "message_removed",
    HiddenEvent = "hidden_event",
}

const SEP = ",";

export default class EventListSummary extends React.Component<
    IProps & Required<Pick<IProps, "summaryLength" | "threshold" | "avatarsMaxLength" | "layout">>
> {
    public static contextType = RoomContext;
    public context!: React.ContextType<typeof RoomContext>;

    public static defaultProps = {
        summaryLength: 1,
        threshold: 3,
        avatarsMaxLength: 5,
        layout: Layout.Group,
    };

    public shouldComponentUpdate(nextProps: IProps): boolean {
        // Update if
        //  - The number of summarised events has changed
        //  - or if the summary is about to toggle to become collapsed
        //  - or if there are fewEvents, meaning the child eventTiles are shown as-is
        return (
            nextProps.events.length !== this.props.events.length ||
            nextProps.events.length < this.props.threshold ||
            nextProps.layout !== this.props.layout
        );
    }

    /**
     * Generate the text for users aggregated by their transition sequences (`eventAggregates`) where
     * the sequences are ordered by `orderedTransitionSequences`.
     * @param {object} eventAggregates a map of transition sequence to array of user display names
     * or user IDs.
     * @param {string[]} orderedTransitionSequences an array which is some ordering of
     * `Object.keys(eventAggregates)`.
     * @returns {string} the textual summary of the aggregated events that occurred.
     */
    private generateSummary(
        eventAggregates: Record<string, string[]>,
        orderedTransitionSequences: string[],
    ): ReactNode {
        const summaries = orderedTransitionSequences.map((transitions) => {
            const userNames = eventAggregates[transitions];
            const nameList = this.renderNameList(userNames);

            const splitTransitions = transitions.split(SEP) as TransitionType[];

            // Some neighbouring transitions are common, so canonicalise some into "pair"
            // transitions
            const canonicalTransitions = EventListSummary.getCanonicalTransitions(splitTransitions);
            // Transform into consecutive repetitions of the same transition (like 5
            // consecutive 'joined_and_left's)
            const coalescedTransitions = EventListSummary.coalesceRepeatedTransitions(canonicalTransitions);

            const descs = coalescedTransitions.map((t) => {
                return EventListSummary.getDescriptionForTransition(t.transitionType, userNames.length, t.repeats);
            });

            const desc = formatCommaSeparatedList(descs);

            return _t("%(nameList)s %(transitionList)s", { nameList, transitionList: desc });
        });

        if (!summaries) {
            return null;
        }

        return jsxJoin(summaries, ", ");
    }

    /**
     * @param {string[]} users an array of user display names or user IDs.
     * @returns {string} a comma-separated list that ends with "and [n] others" if there are
     * more items in `users` than `this.props.summaryLength`, which is the number of names
     * included before "and [n] others".
     */
    private renderNameList(users: string[]): string {
        return formatCommaSeparatedList(users, this.props.summaryLength);
    }

    /**
     * Canonicalise an array of transitions such that some pairs of transitions become
     * single transitions. For example an input ['joined','left'] would result in an output
     * ['joined_and_left'].
     * @param {string[]} transitions an array of transitions.
     * @returns {string[]} an array of transitions.
     */
    private static getCanonicalTransitions(transitions: TransitionType[]): TransitionType[] {
        const modMap: Partial<
            Record<
                TransitionType,
                {
                    after: TransitionType;
                    newTransition: TransitionType;
                }
            >
        > = {
            [TransitionType.Joined]: {
                after: TransitionType.Left,
                newTransition: TransitionType.JoinedAndLeft,
            },
            [TransitionType.Left]: {
                after: TransitionType.Joined,
                newTransition: TransitionType.LeftAndJoined,
            },
        };
        const res: TransitionType[] = [];

        for (let i = 0; i < transitions.length; i++) {
            const t = transitions[i];
            const t2 = transitions[i + 1];

            let transition = t;

            if (i < transitions.length - 1 && modMap[t] && modMap[t]!.after === t2) {
                transition = modMap[t]!.newTransition;
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
    private static coalesceRepeatedTransitions(transitions: TransitionType[]): {
        transitionType: TransitionType;
        repeats: number;
    }[] {
        const res: {
            transitionType: TransitionType;
            repeats: number;
        }[] = [];

        for (const transition of transitions) {
            if (res.length > 0 && res[res.length - 1].transitionType === transition) {
                res[res.length - 1].repeats += 1;
            } else {
                res.push({
                    transitionType: transition,
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
    private static getDescriptionForTransition(t: TransitionType, userCount: number, count: number): ReactNode | null {
        // The empty interpolations 'severalUsers' and 'oneUser'
        // are there only to show translators to non-English languages
        // that the verb is conjugated to plural or singular Subject.
        let res: ReactNode | undefined;
        switch (t) {
            case TransitionType.Joined:
                res =
                    userCount > 1
                        ? _t("%(severalUsers)sjoined %(count)s times", { severalUsers: "", count })
                        : _t("%(oneUser)sjoined %(count)s times", { oneUser: "", count });
                break;
            case TransitionType.Left:
                res =
                    userCount > 1
                        ? _t("%(severalUsers)sleft %(count)s times", { severalUsers: "", count })
                        : _t("%(oneUser)sleft %(count)s times", { oneUser: "", count });
                break;
            case TransitionType.JoinedAndLeft:
                res =
                    userCount > 1
                        ? _t("%(severalUsers)sjoined and left %(count)s times", { severalUsers: "", count })
                        : _t("%(oneUser)sjoined and left %(count)s times", { oneUser: "", count });
                break;
            case TransitionType.LeftAndJoined:
                res =
                    userCount > 1
                        ? _t("%(severalUsers)sleft and rejoined %(count)s times", { severalUsers: "", count })
                        : _t("%(oneUser)sleft and rejoined %(count)s times", { oneUser: "", count });
                break;
            case TransitionType.InviteReject:
                res =
                    userCount > 1
                        ? _t("%(severalUsers)srejected their invitations %(count)s times", {
                              severalUsers: "",
                              count,
                          })
                        : _t("%(oneUser)srejected their invitation %(count)s times", { oneUser: "", count });
                break;
            case TransitionType.InviteWithdrawal:
                res =
                    userCount > 1
                        ? _t("%(severalUsers)shad their invitations withdrawn %(count)s times", {
                              severalUsers: "",
                              count,
                          })
                        : _t("%(oneUser)shad their invitation withdrawn %(count)s times", { oneUser: "", count });
                break;
            case TransitionType.Invited:
                res =
                    userCount > 1
                        ? _t("were invited %(count)s times", { count })
                        : _t("was invited %(count)s times", { count });
                break;
            case TransitionType.Banned:
                res =
                    userCount > 1
                        ? _t("were banned %(count)s times", { count })
                        : _t("was banned %(count)s times", { count });
                break;
            case TransitionType.Unbanned:
                res =
                    userCount > 1
                        ? _t("were unbanned %(count)s times", { count })
                        : _t("was unbanned %(count)s times", { count });
                break;
            case TransitionType.Kicked:
                res =
                    userCount > 1
                        ? _t("were removed %(count)s times", { count })
                        : _t("was removed %(count)s times", { count });
                break;
            case TransitionType.ChangedName:
                res =
                    userCount > 1
                        ? _t("%(severalUsers)schanged their name %(count)s times", { severalUsers: "", count })
                        : _t("%(oneUser)schanged their name %(count)s times", { oneUser: "", count });
                break;
            case TransitionType.ChangedAvatar:
                res =
                    userCount > 1
                        ? _t("%(severalUsers)schanged their avatar %(count)s times", { severalUsers: "", count })
                        : _t("%(oneUser)schanged their avatar %(count)s times", { oneUser: "", count });
                break;
            case TransitionType.NoChange:
                res =
                    userCount > 1
                        ? _t("%(severalUsers)smade no changes %(count)s times", { severalUsers: "", count })
                        : _t("%(oneUser)smade no changes %(count)s times", { oneUser: "", count });
                break;
            case TransitionType.ServerAcl:
                res =
                    userCount > 1
                        ? _t("%(severalUsers)schanged the server ACLs %(count)s times", { severalUsers: "", count })
                        : _t("%(oneUser)schanged the server ACLs %(count)s times", { oneUser: "", count });
                break;
            case TransitionType.ChangedPins:
                res =
                    userCount > 1
                        ? _t(
                              "%(severalUsers)schanged the <a>pinned messages</a> for the room %(count)s times",
                              { severalUsers: "", count },
                              {
                                  a: (sub) => (
                                      <AccessibleButton kind="link_inline" onClick={onPinnedMessagesClick}>
                                          {sub}
                                      </AccessibleButton>
                                  ),
                              },
                          )
                        : _t(
                              "%(oneUser)schanged the <a>pinned messages</a> for the room %(count)s times",
                              { oneUser: "", count },
                              {
                                  a: (sub) => (
                                      <AccessibleButton kind="link_inline" onClick={onPinnedMessagesClick}>
                                          {sub}
                                      </AccessibleButton>
                                  ),
                              },
                          );
                break;
            case TransitionType.MessageRemoved:
                res =
                    userCount > 1
                        ? _t("%(severalUsers)sremoved a message %(count)s times", { severalUsers: "", count })
                        : _t("%(oneUser)sremoved a message %(count)s times", { oneUser: "", count });
                break;
            case TransitionType.HiddenEvent:
                res =
                    userCount > 1
                        ? _t("%(severalUsers)ssent %(count)s hidden messages", { severalUsers: "", count })
                        : _t("%(oneUser)ssent %(count)s hidden messages", { oneUser: "", count });
                break;
        }

        return res ?? null;
    }

    private static getTransitionSequence(events: IUserEvents[]): Array<TransitionType | null> {
        return events.map(EventListSummary.getTransition);
    }

    /**
     * Label a given membership event, `e`, where `getContent().membership` has
     * changed for each transition allowed by the Matrix protocol. This attempts to
     * label the membership changes that occur in `../../../TextForEvent.js`.
     * @param {MatrixEvent} e the membership change event to label.
     * @returns {string?} the transition type given to this event. This defaults to `null`
     * if a transition is not recognised.
     */
    private static getTransition(e: IUserEvents): TransitionType | null {
        if (e.mxEvent.isRedacted()) {
            return TransitionType.MessageRemoved;
        }

        switch (e.mxEvent.getType()) {
            case EventType.RoomThirdPartyInvite:
                // Handle 3pid invites the same as invites so they get bundled together
                if (!isValid3pidInvite(e.mxEvent)) {
                    return TransitionType.InviteWithdrawal;
                }
                return TransitionType.Invited;

            case EventType.RoomServerAcl:
                return TransitionType.ServerAcl;

            case EventType.RoomPinnedEvents:
                return TransitionType.ChangedPins;

            case EventType.RoomMember:
                switch (e.mxEvent.getContent().membership) {
                    case "invite":
                        return TransitionType.Invited;
                    case "ban":
                        return TransitionType.Banned;
                    case "join":
                        if (e.mxEvent.getPrevContent().membership === "join") {
                            if (e.mxEvent.getContent().displayname !== e.mxEvent.getPrevContent().displayname) {
                                return TransitionType.ChangedName;
                            } else if (e.mxEvent.getContent().avatar_url !== e.mxEvent.getPrevContent().avatar_url) {
                                return TransitionType.ChangedAvatar;
                            }
                            return TransitionType.NoChange;
                        } else {
                            return TransitionType.Joined;
                        }
                    case "leave":
                        if (e.mxEvent.getSender() === e.mxEvent.getStateKey()) {
                            if (e.mxEvent.getPrevContent().membership === "invite") {
                                return TransitionType.InviteReject;
                            }
                            return TransitionType.Left;
                        }
                        switch (e.mxEvent.getPrevContent().membership) {
                            case "invite":
                                return TransitionType.InviteWithdrawal;
                            case "ban":
                                return TransitionType.Unbanned;
                            // sender is not target and made the target leave, if not from invite/ban then this is a kick
                            default:
                                return TransitionType.Kicked;
                        }
                    default:
                        return null;
                }

            default:
                // otherwise, assume this is a hidden event
                return TransitionType.HiddenEvent;
        }
    }

    public getAggregate(userEvents: Record<string, IUserEvents[]>): {
        names: Record<string, string[]>;
        indices: Record<string, number>;
    } {
        // A map of aggregate type to arrays of display names. Each aggregate type
        // is a comma-delimited string of transitions, e.g. "joined,left,kicked".
        // The array of display names is the array of users who went through that
        // sequence during eventsToRender.
        const aggregate: Record<string, string[]> = {
            // $aggregateType : []:string
        };
        // A map of aggregate types to the indices that order them (the index of
        // the first event for a given transition sequence)
        const aggregateIndices: Record<string, number> = {
            // $aggregateType : int
        };

        const users = Object.keys(userEvents);
        users.forEach((userId) => {
            const firstEvent = userEvents[userId][0];
            const displayName = firstEvent.displayName;

            const seq = EventListSummary.getTransitionSequence(userEvents[userId]).join(SEP);
            if (!aggregate[seq]) {
                aggregate[seq] = [];
                aggregateIndices[seq] = -1;
            }

            aggregate[seq].push(displayName);

            if (aggregateIndices[seq] === -1 || firstEvent.index < aggregateIndices[seq]) {
                aggregateIndices[seq] = firstEvent.index;
            }
        });

        return {
            names: aggregate,
            indices: aggregateIndices,
        };
    }

    public render(): React.ReactNode {
        const eventsToRender = this.props.events;

        // Map user IDs to latest Avatar Member. ES6 Maps are ordered by when the key was created,
        // so this works perfectly for us to match event order whilst storing the latest Avatar Member
        const latestUserAvatarMember = new Map<string, RoomMember>();

        // Object mapping user IDs to an array of IUserEvents
        const userEvents: Record<string, IUserEvents[]> = {};
        eventsToRender.forEach((e, index) => {
            const type = e.getType();

            let userKey = e.getSender()!;
            if (e.isState() && type === EventType.RoomThirdPartyInvite) {
                userKey = e.getContent().display_name;
            } else if (e.isState() && type === EventType.RoomMember) {
                userKey = e.getStateKey()!;
            } else if (e.isRedacted() && e.getUnsigned()?.redacted_because) {
                userKey = e.getUnsigned().redacted_because!.sender;
            }

            // Initialise a user's events
            if (!userEvents[userKey]) {
                userEvents[userKey] = [];
            }

            let displayName = userKey;
            if (e.isRedacted()) {
                const sender = this.context?.room?.getMember(userKey);
                if (sender) {
                    displayName = sender.name;
                    latestUserAvatarMember.set(userKey, sender);
                }
            } else if (e.target && TARGET_AS_DISPLAY_NAME_EVENTS.includes(type as EventType)) {
                displayName = e.target.name;
                latestUserAvatarMember.set(userKey, e.target);
            } else if (e.sender && type !== EventType.RoomThirdPartyInvite) {
                displayName = e.sender.name;
                latestUserAvatarMember.set(userKey, e.sender);
            }

            userEvents[userKey].push({
                mxEvent: e,
                displayName,
                index: index,
            });
        });

        const aggregate = this.getAggregate(userEvents);

        // Sort types by order of lowest event index within sequence
        const orderedTransitionSequences = Object.keys(aggregate.names).sort(
            (seq1, seq2) => aggregate.indices[seq1] - aggregate.indices[seq2],
        );

        return (
            <GenericEventListSummary
                data-testid={this.props["data-testid"]}
                events={this.props.events}
                threshold={this.props.threshold}
                onToggle={this.props.onToggle}
                startExpanded={this.props.startExpanded}
                children={this.props.children}
                summaryMembers={[...latestUserAvatarMember.values()]}
                layout={this.props.layout}
                summaryText={this.generateSummary(aggregate.names, orderedTransitionSequences)}
            />
        );
    }
}
