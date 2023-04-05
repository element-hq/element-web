/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Relations } from "matrix-js-sdk/src/models/relations";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { M_POLL_KIND_DISCLOSED, M_POLL_RESPONSE, M_POLL_START } from "matrix-js-sdk/src/@types/polls";
import { RelatedRelations } from "matrix-js-sdk/src/models/related-relations";
import { PollStartEvent, PollAnswerSubevent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { PollResponseEvent } from "matrix-js-sdk/src/extensible_events_v1/PollResponseEvent";
import { Poll, PollEvent } from "matrix-js-sdk/src/models/poll";

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import { IBodyProps } from "./IBodyProps";
import { formatCommaSeparatedList } from "../../../utils/FormattingUtils";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import ErrorDialog from "../dialogs/ErrorDialog";
import { GetRelationsForEvent } from "../rooms/EventTile";
import PollCreateDialog from "../elements/PollCreateDialog";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Spinner from "../elements/Spinner";
import { PollOption } from "../polls/PollOption";

interface IState {
    poll?: Poll;
    // poll instance has fetched at least one page of responses
    pollInitialised: boolean;
    selected?: string | null | undefined; // Which option was clicked by the local user
    voteRelations?: Relations; // Voting (response) events
}

export function createVoteRelations(getRelationsForEvent: GetRelationsForEvent, eventId: string): RelatedRelations {
    const relationsList: Relations[] = [];

    const pollResponseRelations = getRelationsForEvent(eventId, "m.reference", M_POLL_RESPONSE.name);
    if (pollResponseRelations) {
        relationsList.push(pollResponseRelations);
    }

    const pollResposnseAltRelations = getRelationsForEvent(eventId, "m.reference", M_POLL_RESPONSE.altName);
    if (pollResposnseAltRelations) {
        relationsList.push(pollResposnseAltRelations);
    }

    return new RelatedRelations(relationsList);
}

export function findTopAnswer(pollEvent: MatrixEvent, voteRelations: Relations): string {
    const pollEventId = pollEvent.getId();
    if (!pollEventId) {
        logger.warn(
            "findTopAnswer: Poll event needs an event ID to fetch relations in order to determine " +
                "the top answer - assuming no best answer",
        );
        return "";
    }

    const poll = pollEvent.unstableExtensibleEvent as PollStartEvent;
    if (!poll?.isEquivalentTo(M_POLL_START)) {
        logger.warn("Failed to parse poll to determine top answer - assuming no best answer");
        return "";
    }

    const findAnswerText = (answerId: string): string => {
        return poll.answers.find((a) => a.id === answerId)?.text ?? "";
    };

    const userVotes: Map<string, UserVote> = collectUserVotes(allVotes(voteRelations));

    const votes: Map<string, number> = countVotes(userVotes, poll);
    const highestScore: number = Math.max(...votes.values());

    const bestAnswerIds: string[] = [];
    for (const [answerId, score] of votes) {
        if (score == highestScore) {
            bestAnswerIds.push(answerId);
        }
    }

    const bestAnswerTexts = bestAnswerIds.map(findAnswerText);

    return formatCommaSeparatedList(bestAnswerTexts, 3);
}

export function isPollEnded(pollEvent: MatrixEvent, matrixClient: MatrixClient): boolean {
    const room = matrixClient.getRoom(pollEvent.getRoomId());
    const poll = room?.polls.get(pollEvent.getId()!);
    if (!poll || poll.isFetchingResponses) {
        return false;
    }
    return poll.isEnded;
}

export function pollAlreadyHasVotes(mxEvent: MatrixEvent, getRelationsForEvent?: GetRelationsForEvent): boolean {
    if (!getRelationsForEvent) return false;

    const eventId = mxEvent.getId();
    if (!eventId) return false;

    const voteRelations = createVoteRelations(getRelationsForEvent, eventId);
    return voteRelations.getRelations().length > 0;
}

export function launchPollEditor(mxEvent: MatrixEvent, getRelationsForEvent?: GetRelationsForEvent): void {
    const room = MatrixClientPeg.get().getRoom(mxEvent.getRoomId());
    if (pollAlreadyHasVotes(mxEvent, getRelationsForEvent)) {
        Modal.createDialog(ErrorDialog, {
            title: _t("Can't edit poll"),
            description: _t("Sorry, you can't edit a poll after votes have been cast."),
        });
    } else if (room) {
        Modal.createDialog(
            PollCreateDialog,
            {
                room,
                threadId: mxEvent.getThread()?.id,
                editingMxEvent: mxEvent,
            },
            "mx_CompoundDialog",
            false, // isPriorityModal
            true, // isStaticModal
        );
    }
}

export default class MPollBody extends React.Component<IBodyProps, IState> {
    public static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;
    private seenEventIds: string[] = []; // Events we have already seen

    public constructor(props: IBodyProps) {
        super(props);

        this.state = {
            selected: null,
            pollInitialised: false,
        };
    }

    public componentDidMount(): void {
        const room = this.context?.getRoom(this.props.mxEvent.getRoomId());
        const poll = room?.polls.get(this.props.mxEvent.getId()!);
        if (poll) {
            this.setPollInstance(poll);
        } else {
            room?.on(PollEvent.New, this.setPollInstance.bind(this));
        }
    }

    public componentWillUnmount(): void {
        this.removeListeners();
    }

    private async setPollInstance(poll: Poll): Promise<void> {
        if (poll.pollId !== this.props.mxEvent.getId()) {
            return;
        }
        this.setState({ poll }, () => {
            this.addListeners();
        });
        const responses = await poll.getResponses();
        const voteRelations = responses;

        this.setState({ pollInitialised: true, voteRelations });
    }

    private addListeners(): void {
        this.state.poll?.on(PollEvent.Responses, this.onResponsesChange);
        this.state.poll?.on(PollEvent.End, this.onRelationsChange);
        this.state.poll?.on(PollEvent.UndecryptableRelations, this.render.bind(this));
    }

    private removeListeners(): void {
        if (this.state.poll) {
            this.state.poll.off(PollEvent.Responses, this.onResponsesChange);
            this.state.poll.off(PollEvent.End, this.onRelationsChange);
            this.state.poll.off(PollEvent.UndecryptableRelations, this.render.bind(this));
        }
    }

    private onResponsesChange = (responses: Relations): void => {
        this.setState({ voteRelations: responses });
        this.onRelationsChange();
    };

    private onRelationsChange = (): void => {
        // We hold Relations in our state, and they changed under us.
        // Check whether we should delete our selection, and then
        // re-render.
        // Note: re-rendering is a side effect of unselectIfNewEventFromMe().
        this.unselectIfNewEventFromMe();
    };

    private selectOption(answerId: string): void {
        if (this.state.poll?.isEnded) {
            return;
        }
        const userVotes = this.collectUserVotes();
        const userId = this.context.getSafeUserId();
        const myVote = userVotes.get(userId)?.answers[0];
        if (answerId === myVote) {
            return;
        }

        const response = PollResponseEvent.from([answerId], this.props.mxEvent.getId()!).serialize();

        this.context.sendEvent(this.props.mxEvent.getRoomId()!, response.type, response.content).catch((e: any) => {
            console.error("Failed to submit poll response event:", e);

            Modal.createDialog(ErrorDialog, {
                title: _t("Vote not registered"),
                description: _t("Sorry, your vote was not registered. Please try again."),
            });
        });

        this.setState({ selected: answerId });
    }

    /**
     * @returns userId -> UserVote
     */
    private collectUserVotes(): Map<string, UserVote> {
        if (!this.state.voteRelations || !this.context) {
            return new Map<string, UserVote>();
        }
        return collectUserVotes(allVotes(this.state.voteRelations), this.context.getUserId(), this.state.selected);
    }

    /**
     * If we've just received a new event that we hadn't seen
     * before, and that event is me voting (e.g. from a different
     * device) then forget when the local user selected.
     *
     * Either way, calls setState to update our list of events we
     * have already seen.
     */
    private unselectIfNewEventFromMe(): void {
        const relations = this.state.voteRelations?.getRelations() || [];
        const newEvents: MatrixEvent[] = relations.filter(
            (mxEvent: MatrixEvent) => !this.seenEventIds.includes(mxEvent.getId()!),
        );
        let newSelected = this.state.selected;

        if (newEvents.length > 0) {
            for (const mxEvent of newEvents) {
                if (mxEvent.getSender() === this.context.getUserId()) {
                    newSelected = null;
                }
            }
        }
        const newEventIds = newEvents.map((mxEvent: MatrixEvent) => mxEvent.getId()!);
        this.seenEventIds = this.seenEventIds.concat(newEventIds);
        this.setState({ selected: newSelected });
    }

    private totalVotes(collectedVotes: Map<string, number>): number {
        let sum = 0;
        for (const v of collectedVotes.values()) {
            sum += v;
        }
        return sum;
    }

    public render(): ReactNode {
        const { poll, pollInitialised } = this.state;
        if (!poll?.pollEvent) {
            return null;
        }

        const pollEvent = poll.pollEvent;

        const pollId = this.props.mxEvent.getId()!;
        const isFetchingResponses = !pollInitialised || poll.isFetchingResponses;
        const userVotes = this.collectUserVotes();
        const votes = countVotes(userVotes, pollEvent);
        const totalVotes = this.totalVotes(votes);
        const winCount = Math.max(...votes.values());
        const userId = this.context.getSafeUserId();
        const myVote = userVotes?.get(userId)?.answers[0];
        const disclosed = M_POLL_KIND_DISCLOSED.matches(pollEvent.kind.name);

        // Disclosed: votes are hidden until I vote or the poll ends
        // Undisclosed: votes are hidden until poll ends
        const showResults = poll.isEnded || (disclosed && myVote !== undefined);

        let totalText: string;
        if (showResults && poll.undecryptableRelationsCount) {
            totalText = _t("Due to decryption errors, some votes may not be counted");
        } else if (poll.isEnded) {
            totalText = _t("Final result based on %(count)s votes", { count: totalVotes });
        } else if (!disclosed) {
            totalText = _t("Results will be visible when the poll is ended");
        } else if (myVote === undefined) {
            if (totalVotes === 0) {
                totalText = _t("No votes cast");
            } else {
                totalText = _t("%(count)s votes cast. Vote to see the results", { count: totalVotes });
            }
        } else {
            totalText = _t("Based on %(count)s votes", { count: totalVotes });
        }

        const editedSpan = this.props.mxEvent.replacingEvent() ? (
            <span className="mx_MPollBody_edited"> ({_t("edited")})</span>
        ) : null;

        return (
            <div className="mx_MPollBody">
                <h2 data-testid="pollQuestion">
                    {pollEvent.question.text}
                    {editedSpan}
                </h2>
                <div className="mx_MPollBody_allOptions">
                    {pollEvent.answers.map((answer: PollAnswerSubevent) => {
                        let answerVotes = 0;

                        if (showResults) {
                            answerVotes = votes.get(answer.id) ?? 0;
                        }

                        const checked =
                            (!poll.isEnded && myVote === answer.id) || (poll.isEnded && answerVotes === winCount);

                        return (
                            <PollOption
                                key={answer.id}
                                pollId={pollId}
                                answer={answer}
                                isChecked={checked}
                                isEnded={poll.isEnded}
                                voteCount={answerVotes}
                                totalVoteCount={totalVotes}
                                displayVoteCount={showResults}
                                onOptionSelected={this.selectOption.bind(this)}
                            />
                        );
                    })}
                </div>
                <div data-testid="totalVotes" className="mx_MPollBody_totalVotes">
                    {totalText}
                    {isFetchingResponses && <Spinner w={16} h={16} />}
                </div>
            </div>
        );
    }
}
export class UserVote {
    public constructor(public readonly ts: number, public readonly sender: string, public readonly answers: string[]) {}
}

function userResponseFromPollResponseEvent(event: MatrixEvent): UserVote {
    const response = event.unstableExtensibleEvent as PollResponseEvent;
    if (!response?.isEquivalentTo(M_POLL_RESPONSE)) {
        throw new Error("Failed to parse Poll Response Event to determine user response");
    }

    return new UserVote(event.getTs(), event.getSender()!, response.answerIds);
}

export function allVotes(voteRelations: Relations): Array<UserVote> {
    if (voteRelations) {
        return voteRelations.getRelations().map(userResponseFromPollResponseEvent);
    } else {
        return [];
    }
}

/**
 * Figure out the correct vote for each user.
 * @param userResponses current vote responses in the poll
 * @param {string?} userId The userId for which the `selected` option will apply to.
 *                  Should be set to the current user ID.
 * @param {string?} selected Local echo selected option for the userId
 * @returns a Map of user ID to their vote info
 */
export function collectUserVotes(
    userResponses: Array<UserVote>,
    userId?: string | null | undefined,
    selected?: string | null | undefined,
): Map<string, UserVote> {
    const userVotes: Map<string, UserVote> = new Map();

    for (const response of userResponses) {
        const otherResponse = userVotes.get(response.sender);
        if (!otherResponse || otherResponse.ts < response.ts) {
            userVotes.set(response.sender, response);
        }
    }

    if (selected && userId) {
        userVotes.set(userId, new UserVote(0, userId, [selected]));
    }

    return userVotes;
}

export function countVotes(userVotes: Map<string, UserVote>, pollStart: PollStartEvent): Map<string, number> {
    const collected = new Map<string, number>();

    for (const response of userVotes.values()) {
        const tempResponse = PollResponseEvent.from(response.answers, "$irrelevant");
        tempResponse.validateAgainst(pollStart);
        if (!tempResponse.spoiled) {
            for (const answerId of tempResponse.answerIds) {
                if (collected.has(answerId)) {
                    collected.set(answerId, collected.get(answerId)! + 1);
                } else {
                    collected.set(answerId, 1);
                }
            }
        }
    }

    return collected;
}
