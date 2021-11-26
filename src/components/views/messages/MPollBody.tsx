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
import { _t } from '../../../languageHandler';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import Modal from '../../../Modal';
import { IBodyProps } from "./IBodyProps";
import {
    IPollAnswer,
    IPollContent,
    IPollResponse,
    POLL_RESPONSE_EVENT_TYPE,
    POLL_START_EVENT_TYPE,
} from '../../../polls/consts';
import StyledRadioButton from '../elements/StyledRadioButton';
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Relations } from 'matrix-js-sdk/src/models/relations';
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import ErrorDialog from '../dialogs/ErrorDialog';

// TODO: [andyb] Use extensible events library when ready
const TEXT_NODE_TYPE = "org.matrix.msc1767.text";

interface IState {
    selected?: string;
    pollRelations: Relations;
}

@replaceableComponent("views.messages.MPollBody")
export default class MPollBody extends React.Component<IBodyProps, IState> {
    static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;

    constructor(props: IBodyProps) {
        super(props);

        this.state = {
            selected: null,
            pollRelations: this.fetchPollRelations(),
        };

        this.addListeners(this.state.pollRelations);
        this.props.mxEvent.on("Event.relationsCreated", this.onPollRelationsCreated);
    }

    componentWillUnmount() {
        this.props.mxEvent.off("Event.relationsCreated", this.onPollRelationsCreated);
        this.removeListeners(this.state.pollRelations);
    }

    private addListeners(pollRelations?: Relations) {
        if (pollRelations) {
            pollRelations.on("Relations.add", this.onRelationsChange);
            pollRelations.on("Relations.remove", this.onRelationsChange);
            pollRelations.on("Relations.redaction", this.onRelationsChange);
        }
    }

    private removeListeners(pollRelations?: Relations) {
        if (pollRelations) {
            pollRelations.off("Relations.add", this.onRelationsChange);
            pollRelations.off("Relations.remove", this.onRelationsChange);
            pollRelations.off("Relations.redaction", this.onRelationsChange);
        }
    }

    private onPollRelationsCreated = (relationType: string, eventType: string) => {
        if (
            relationType === "m.reference" &&
            POLL_RESPONSE_EVENT_TYPE.matches(eventType)
        ) {
            this.props.mxEvent.removeListener(
                "Event.relationsCreated", this.onPollRelationsCreated);

            const newPollRelations = this.fetchPollRelations();
            this.addListeners(newPollRelations);
            this.removeListeners(this.state.pollRelations);

            this.setState({
                pollRelations: newPollRelations,
            });
        }
    };

    private onRelationsChange = () => {
        // We hold pollRelations in our state, and it has changed under us
        this.forceUpdate();
    };

    private selectOption(answerId: string) {
        if (answerId === this.state.selected) {
            return;
        }

        const responseContent: IPollResponse = {
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
        ).catch(e => {
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

    private fetchPollRelations(): Relations | null {
        if (this.props.getRelationsForEvent) {
            return this.props.getRelationsForEvent(
                this.props.mxEvent.getId(),
                "m.reference",
                POLL_RESPONSE_EVENT_TYPE.name,
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
            allVotes(this.state.pollRelations),
            this.context.getUserId(),
            this.state.selected,
        );
    }

    private totalVotes(collectedVotes: Map<string, number>): number {
        let sum = 0;
        for (const v of collectedVotes.values()) {
            sum += v;
        }
        return sum;
    }

    render() {
        const pollStart: IPollContent = this.props.mxEvent.getContent();
        const pollInfo = pollStart[POLL_START_EVENT_TYPE.name];

        if (pollInfo.answers.length < 1 || pollInfo.answers.length > 20) {
            return null;
        }

        const pollId = this.props.mxEvent.getId();
        const userVotes = this.collectUserVotes();
        const votes = countVotes(userVotes, this.props.mxEvent.getContent());
        const totalVotes = this.totalVotes(votes);
        const userId = this.context.getUserId();
        const myVote = userVotes.get(userId)?.answers[0];

        return <div className="mx_MPollBody">
            <h2>{ pollInfo.question[TEXT_NODE_TYPE] }</h2>
            <div className="mx_MPollBody_allOptions">
                {
                    pollInfo.answers.map((answer: IPollAnswer) => {
                        const checked = myVote === answer.id;
                        const classNames = `mx_MPollBody_option${
                            checked ? " mx_MPollBody_option_checked": ""
                        }`;
                        const answerVotes = votes.get(answer.id) ?? 0;
                        const answerPercent = Math.round(
                            100.0 * answerVotes / totalVotes);
                        return <div
                            key={answer.id}
                            className={classNames}
                            onClick={() => this.selectOption(answer.id)}
                        >
                            <StyledRadioButton
                                name={`poll_answer_select-${pollId}`}
                                value={answer.id}
                                checked={checked}
                                onChange={this.onOptionSelected}
                            >
                                <div className="mx_MPollBody_optionDescription">
                                    <div className="mx_MPollBody_optionText">
                                        { answer[TEXT_NODE_TYPE] }
                                    </div>
                                    <div className="mx_MPollBody_optionVoteCount">
                                        { _t("%(count)s votes", { count: answerVotes }) }
                                    </div>
                                </div>
                            </StyledRadioButton>
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
                { _t( "Based on %(count)s votes", { count: totalVotes } ) }
            </div>
        </div>;
    }
}

export class UserVote {
    constructor(public readonly ts: number, public readonly sender: string, public readonly answers: string[]) {
    }
}

function userResponseFromPollResponseEvent(event: MatrixEvent): UserVote {
    const pr = event.getContent() as IPollResponse;
    const answers = pr[POLL_RESPONSE_EVENT_TYPE.name].answers;

    return new UserVote(
        event.getTs(),
        event.getSender(),
        answers,
    );
}

export function allVotes(pollRelations: Relations): Array<UserVote> {
    function isPollResponse(responseEvent: MatrixEvent): boolean {
        return (
            responseEvent.getType() === POLL_RESPONSE_EVENT_TYPE.name &&
            responseEvent.getContent().hasOwnProperty(POLL_RESPONSE_EVENT_TYPE.name)
        );
    }

    if (pollRelations) {
        return pollRelations.getRelations()
            .filter(isPollResponse)
            .map(userResponseFromPollResponseEvent);
    } else {
        return [];
    }
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
