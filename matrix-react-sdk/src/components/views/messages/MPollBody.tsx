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

import React from 'react';
import classNames from 'classnames';
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Relations } from 'matrix-js-sdk/src/models/relations';
import { MatrixClient } from 'matrix-js-sdk/src/matrix';
import { TEXT_NODE_TYPE } from "matrix-js-sdk/src/@types/extensible_events";
import {
    IPollAnswer,
    IPollContent,
    IPollResponseContent,
    POLL_END_EVENT_TYPE,
    POLL_RESPONSE_EVENT_TYPE,
    POLL_START_EVENT_TYPE,
} from "matrix-js-sdk/src/@types/polls";

import { _t } from '../../../languageHandler';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import Modal from '../../../Modal';
import { IBodyProps } from "./IBodyProps";
import { formatCommaSeparatedList } from '../../../utils/FormattingUtils';
import StyledRadioButton from '../elements/StyledRadioButton';
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import ErrorDialog from '../dialogs/ErrorDialog';

interface IState {
    selected?: string; // Which option was clicked by the local user
    voteRelations: Relations; // Voting (response) events
    endRelations: Relations; // Poll end events
}

export function findTopAnswer(
    pollEvent: MatrixEvent,
    matrixClient: MatrixClient,
    getRelationsForEvent?: (
        eventId: string,
        relationType: string,
        eventType: string
    ) => Relations,
): string {
    if (!getRelationsForEvent) {
        return "";
    }

    const pollContents: IPollContent = pollEvent.getContent();

    const findAnswerText = (answerId: string) => {
        for (const answer of pollContents[POLL_START_EVENT_TYPE.name].answers) {
            if (answer.id == answerId) {
                return answer[TEXT_NODE_TYPE.name];
            }
        }
        return "";
    };

    const voteRelations: Relations = getRelationsForEvent(
        pollEvent.getId(),
        "m.reference",
        POLL_RESPONSE_EVENT_TYPE.name,
    );

    const endRelations: Relations = getRelationsForEvent(
        pollEvent.getId(),
        "m.reference",
        POLL_END_EVENT_TYPE.name,
    );

    const userVotes: Map<string, UserVote> = collectUserVotes(
        allVotes(pollEvent, matrixClient, voteRelations, endRelations),
        matrixClient.getUserId(),
        null,
    );

    const votes: Map<string, number> = countVotes(userVotes, pollEvent.getContent());
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

export function isPollEnded(
    pollEvent: MatrixEvent,
    matrixClient: MatrixClient,
    getRelationsForEvent?: (
        eventId: string,
        relationType: string,
        eventType: string
    ) => Relations,
): boolean {
    if (!getRelationsForEvent) {
        return false;
    }

    const roomCurrentState = matrixClient.getRoom(pollEvent.getRoomId()).currentState;
    function userCanRedact(endEvent: MatrixEvent) {
        return roomCurrentState.maySendRedactionForEvent(
            pollEvent,
            endEvent.getSender(),
        );
    }

    const endRelations = getRelationsForEvent(
        pollEvent.getId(),
        "m.reference",
        POLL_END_EVENT_TYPE.name,
    );

    if (!endRelations) {
        return false;
    }

    const authorisedRelations = endRelations.getRelations().filter(userCanRedact);

    return authorisedRelations.length > 0;
}

@replaceableComponent("views.messages.MPollBody")
export default class MPollBody extends React.Component<IBodyProps, IState> {
    public static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;
    private seenEventIds: string[] = []; // Events we have already seen
    private voteRelationsReceived = false;
    private endRelationsReceived = false;

    constructor(props: IBodyProps) {
        super(props);

        this.state = {
            selected: null,
            voteRelations: this.fetchVoteRelations(),
            endRelations: this.fetchEndRelations(),
        };

        this.addListeners(this.state.voteRelations, this.state.endRelations);
        this.props.mxEvent.on("Event.relationsCreated", this.onRelationsCreated);
    }

    componentWillUnmount() {
        this.props.mxEvent.off("Event.relationsCreated", this.onRelationsCreated);
        this.removeListeners(this.state.voteRelations, this.state.endRelations);
    }

    private addListeners(voteRelations?: Relations, endRelations?: Relations) {
        if (voteRelations) {
            voteRelations.on("Relations.add", this.onRelationsChange);
            voteRelations.on("Relations.remove", this.onRelationsChange);
            voteRelations.on("Relations.redaction", this.onRelationsChange);
        }
        if (endRelations) {
            endRelations.on("Relations.add", this.onRelationsChange);
            endRelations.on("Relations.remove", this.onRelationsChange);
            endRelations.on("Relations.redaction", this.onRelationsChange);
        }
    }

    private removeListeners(voteRelations?: Relations, endRelations?: Relations) {
        if (voteRelations) {
            voteRelations.off("Relations.add", this.onRelationsChange);
            voteRelations.off("Relations.remove", this.onRelationsChange);
            voteRelations.off("Relations.redaction", this.onRelationsChange);
        }
        if (endRelations) {
            endRelations.off("Relations.add", this.onRelationsChange);
            endRelations.off("Relations.remove", this.onRelationsChange);
            endRelations.off("Relations.redaction", this.onRelationsChange);
        }
    }

    private onRelationsCreated = (relationType: string, eventType: string) => {
        if (relationType !== "m.reference") {
            return;
        }

        if (POLL_RESPONSE_EVENT_TYPE.matches(eventType)) {
            this.voteRelationsReceived = true;
            const newVoteRelations = this.fetchVoteRelations();
            this.addListeners(newVoteRelations);
            this.removeListeners(this.state.voteRelations);
            this.setState({ voteRelations: newVoteRelations });
        } else if (POLL_END_EVENT_TYPE.matches(eventType)) {
            this.endRelationsReceived = true;
            const newEndRelations = this.fetchEndRelations();
            this.addListeners(newEndRelations);
            this.removeListeners(this.state.endRelations);
            this.setState({ endRelations: newEndRelations });
        }

        if (this.voteRelationsReceived && this.endRelationsReceived) {
            this.props.mxEvent.removeListener(
                "Event.relationsCreated", this.onRelationsCreated);
        }
    };

    private onRelationsChange = () => {
        // We hold Relations in our state, and they changed under us.
        // Check whether we should delete our selection, and then
        // re-render.
        // Note: re-rendering is a side effect of unselectIfNewEventFromMe().
        this.unselectIfNewEventFromMe();
    };

    private selectOption(answerId: string) {
        if (this.isEnded()) {
            return;
        }
        const userVotes = this.collectUserVotes();
        const userId = this.context.getUserId();
        const myVote = userVotes.get(userId)?.answers[0];
        if (answerId === myVote) {
            return;
        }

        const responseContent: IPollResponseContent = {
            [POLL_RESPONSE_EVENT_TYPE.name]: {
                "answers": [answerId],
            },
            "m.relates_to": {
                "event_id": this.props.mxEvent.getId(),
                "rel_type": "m.reference",
            },
        };

        this.context.sendEvent(
            this.props.mxEvent.getRoomId(),
            POLL_RESPONSE_EVENT_TYPE.name,
            responseContent,
        ).catch((e: any) => {
            console.error("Failed to submit poll response event:", e);

            Modal.createTrackedDialog(
                'Vote not registered',
                '',
                ErrorDialog,
                {
                    title: _t("Vote not registered"),
                    description: _t(
                        "Sorry, your vote was not registered. Please try again."),
                },
            );
        });

        this.setState({ selected: answerId });
    }

    private onOptionSelected = (e: React.FormEvent<HTMLInputElement>): void => {
        this.selectOption(e.currentTarget.value);
    };

    private fetchVoteRelations(): Relations | null {
        return this.fetchRelations(POLL_RESPONSE_EVENT_TYPE.name);
    }

    private fetchEndRelations(): Relations | null {
        return this.fetchRelations(POLL_END_EVENT_TYPE.name);
    }

    private fetchRelations(eventType: string): Relations | null {
        if (this.props.getRelationsForEvent) {
            return this.props.getRelationsForEvent(
                this.props.mxEvent.getId(),
                "m.reference",
                eventType,
            );
        } else {
            return null;
        }
    }

    /**
     * @returns userId -> UserVote
     */
    private collectUserVotes(): Map<string, UserVote> {
        return collectUserVotes(
            allVotes(
                this.props.mxEvent,
                this.context,
                this.state.voteRelations,
                this.state.endRelations,
            ),
            this.context.getUserId(),
            this.state.selected,
        );
    }

    /**
     * If we've just received a new event that we hadn't seen
     * before, and that event is me voting (e.g. from a different
     * device) then forget when the local user selected.
     *
     * Either way, calls setState to update our list of events we
     * have already seen.
     */
    private unselectIfNewEventFromMe() {
        const newEvents: MatrixEvent[] = this.state.voteRelations.getRelations()
            .filter(isPollResponse)
            .filter((mxEvent: MatrixEvent) =>
                !this.seenEventIds.includes(mxEvent.getId()));
        let newSelected = this.state.selected;

        if (newEvents.length > 0) {
            for (const mxEvent of newEvents) {
                if (mxEvent.getSender() === this.context.getUserId()) {
                    newSelected = null;
                }
            }
        }
        const newEventIds = newEvents.map((mxEvent: MatrixEvent) => mxEvent.getId());
        this.seenEventIds = this.seenEventIds.concat(newEventIds);
        this.setState( { selected: newSelected } );
    }

    private totalVotes(collectedVotes: Map<string, number>): number {
        let sum = 0;
        for (const v of collectedVotes.values()) {
            sum += v;
        }
        return sum;
    }

    private isEnded(): boolean {
        return isPollEnded(
            this.props.mxEvent,
            this.context,
            this.props.getRelationsForEvent,
        );
    }

    render() {
        const pollStart: IPollContent = this.props.mxEvent.getContent();
        const pollInfo = pollStart[POLL_START_EVENT_TYPE.name];

        if (pollInfo.answers.length < 1 || pollInfo.answers.length > 20) {
            return null;
        }

        const ended = this.isEnded();
        const pollId = this.props.mxEvent.getId();
        const userVotes = this.collectUserVotes();
        const votes = countVotes(userVotes, this.props.mxEvent.getContent());
        const totalVotes = this.totalVotes(votes);
        const winCount = Math.max(...votes.values());
        const userId = this.context.getUserId();
        const myVote = userVotes.get(userId)?.answers[0];

        let totalText: string;
        if (ended) {
            totalText = _t(
                "Final result based on %(count)s votes",
                { count: totalVotes },
            );
        } else if (myVote === undefined) {
            if (totalVotes === 0) {
                totalText = _t("No votes cast");
            } else {
                totalText = _t(
                    "%(count)s votes cast. Vote to see the results",
                    { count: totalVotes },
                );
            }
        } else {
            totalText = _t( "Based on %(count)s votes", { count: totalVotes } );
        }

        return <div className="mx_MPollBody">
            <h2>{ pollInfo.question[TEXT_NODE_TYPE.name] }</h2>
            <div className="mx_MPollBody_allOptions">
                {
                    pollInfo.answers.map((answer: IPollAnswer) => {
                        let answerVotes = 0;
                        let votesText = "";

                        // Votes are hidden until I vote or the poll ends
                        if (ended || myVote !== undefined) {
                            answerVotes = votes.get(answer.id) ?? 0;
                            votesText = _t("%(count)s votes", { count: answerVotes });
                        }

                        const checked = (
                            (!ended && myVote === answer.id) ||
                            (ended && answerVotes === winCount)
                        );
                        const cls = classNames({
                            "mx_MPollBody_option": true,
                            "mx_MPollBody_option_checked": checked,
                        });

                        const answerPercent = (
                            totalVotes === 0
                                ? 0
                                : Math.round(100.0 * answerVotes / totalVotes)
                        );
                        return <div
                            key={answer.id}
                            className={cls}
                            onClick={() => this.selectOption(answer.id)}
                        >
                            { (
                                ended
                                    ? <EndedPollOption
                                        answer={answer}
                                        checked={checked}
                                        votesText={votesText} />
                                    : <LivePollOption
                                        pollId={pollId}
                                        answer={answer}
                                        checked={checked}
                                        votesText={votesText}
                                        onOptionSelected={this.onOptionSelected} />
                            ) }
                            <div className="mx_MPollBody_popularityBackground">
                                <div
                                    className="mx_MPollBody_popularityAmount"
                                    style={{ "width": `${answerPercent}%` }}
                                />
                            </div>
                        </div>;
                    })
                }
            </div>
            <div className="mx_MPollBody_totalVotes">
                { totalText }
            </div>
        </div>;
    }
}

interface IEndedPollOptionProps {
    answer: IPollAnswer;
    checked: boolean;
    votesText: string;
}

function EndedPollOption(props: IEndedPollOptionProps) {
    const cls = classNames({
        "mx_MPollBody_endedOption": true,
        "mx_MPollBody_endedOptionWinner": props.checked,
    });
    return <div className={cls} data-value={props.answer.id}>
        <div className="mx_MPollBody_optionDescription">
            <div className="mx_MPollBody_optionText">
                { props.answer[TEXT_NODE_TYPE.name] }
            </div>
            <div className="mx_MPollBody_optionVoteCount">
                { props.votesText }
            </div>
        </div>
    </div>;
}

interface ILivePollOptionProps {
    pollId: string;
    answer: IPollAnswer;
    checked: boolean;
    votesText: string;
    onOptionSelected: (e: React.FormEvent<HTMLInputElement>) => void;
}

function LivePollOption(props: ILivePollOptionProps) {
    return <StyledRadioButton
        name={`poll_answer_select-${props.pollId}`}
        value={props.answer.id}
        checked={props.checked}
        onChange={props.onOptionSelected}
    >
        <div className="mx_MPollBody_optionDescription">
            <div className="mx_MPollBody_optionText">
                { props.answer[TEXT_NODE_TYPE.name] }
            </div>
            <div className="mx_MPollBody_optionVoteCount">
                { props.votesText }
            </div>
        </div>
    </StyledRadioButton>;
}

export class UserVote {
    constructor(public readonly ts: number, public readonly sender: string, public readonly answers: string[]) {
    }
}

function userResponseFromPollResponseEvent(event: MatrixEvent): UserVote {
    const pr = event.getContent() as IPollResponseContent;
    const answers = pr[POLL_RESPONSE_EVENT_TYPE.name].answers;

    return new UserVote(
        event.getTs(),
        event.getSender(),
        answers,
    );
}

export function allVotes(
    pollEvent: MatrixEvent,
    matrixClient: MatrixClient,
    voteRelations: Relations,
    endRelations: Relations,
): Array<UserVote> {
    const endTs = pollEndTs(pollEvent, matrixClient, endRelations);

    function isOnOrBeforeEnd(responseEvent: MatrixEvent): boolean {
        // From MSC3381:
        // "Votes sent on or before the end event's timestamp are valid votes"
        return (
            endTs === null ||
            responseEvent.getTs() <= endTs
        );
    }

    if (voteRelations) {
        return voteRelations.getRelations()
            .filter(isPollResponse)
            .filter(isOnOrBeforeEnd)
            .map(userResponseFromPollResponseEvent);
    } else {
        return [];
    }
}

/**
 * Returns the earliest timestamp from the supplied list of end_poll events
 * or null if there are no authorised events.
 */
export function pollEndTs(
    pollEvent: MatrixEvent,
    matrixClient: MatrixClient,
    endRelations: Relations,
): number | null {
    if (!endRelations) {
        return null;
    }

    const roomCurrentState = matrixClient.getRoom(pollEvent.getRoomId()).currentState;
    function userCanRedact(endEvent: MatrixEvent) {
        return roomCurrentState.maySendRedactionForEvent(
            pollEvent,
            endEvent.getSender(),
        );
    }

    const tss: number[] = (
        endRelations
            .getRelations()
            .filter(userCanRedact)
            .map((evt: MatrixEvent) => evt.getTs())
    );

    if (tss.length === 0) {
        return null;
    } else {
        return Math.min(...tss);
    }
}

function isPollResponse(responseEvent: MatrixEvent): boolean {
    return (
        POLL_RESPONSE_EVENT_TYPE.matches(responseEvent.getType()) &&
        POLL_RESPONSE_EVENT_TYPE.findIn(responseEvent.getContent())
    );
}

/**
 * Figure out the correct vote for each user.
 * @returns a Map of user ID to their vote info
 */
function collectUserVotes(
    userResponses: Array<UserVote>,
    userId: string,
    selected?: string,
): Map<string, UserVote> {
    const userVotes: Map<string, UserVote> = new Map();

    for (const response of userResponses) {
        const otherResponse = userVotes.get(response.sender);
        if (!otherResponse || otherResponse.ts < response.ts) {
            userVotes.set(response.sender, response);
        }
    }

    if (selected) {
        userVotes.set(userId, new UserVote(0, userId, [selected]));
    }

    return userVotes;
}

function countVotes(
    userVotes: Map<string, UserVote>,
    pollStart: IPollContent,
): Map<string, number> {
    const collected = new Map<string, number>();

    const pollInfo = pollStart[POLL_START_EVENT_TYPE.name];
    const maxSelections = 1;  // See MSC3381 - later this will be in pollInfo

    const allowedAnswerIds = pollInfo.answers.map((ans: IPollAnswer) => ans.id);
    function isValidAnswer(answerId: string) {
        return allowedAnswerIds.includes(answerId);
    }

    for (const response of userVotes.values()) {
        if (response.answers.every(isValidAnswer)) {
            for (const [index, answerId] of response.answers.entries()) {
                if (index >= maxSelections) {
                    break;
                }
                if (collected.has(answerId)) {
                    collected.set(answerId, collected.get(answerId) + 1);
                } else {
                    collected.set(answerId, 1);
                }
            }
        }
    }

    return collected;
}
