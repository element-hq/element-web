/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React, { useEffect, useState } from "react";
import { PollAnswerSubevent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { MatrixEvent, Poll, PollEvent } from "matrix-js-sdk/src/matrix";
import { Relations } from "matrix-js-sdk/src/models/relations";

import { Icon as PollIcon } from "../../../../../res/img/element-icons/room/composer/poll.svg";
import { _t } from "../../../../languageHandler";
import { formatLocalDateShort } from "../../../../DateUtils";
import { allVotes, collectUserVotes, countVotes } from "../../messages/MPollBody";
import { PollOption } from "../../polls/PollOption";
import { Caption } from "../../typography/Caption";
import TooltipTarget from "../../elements/TooltipTarget";
import { Alignment } from "../../elements/Tooltip";

interface Props {
    event: MatrixEvent;
    poll: Poll;
    onClick: () => void;
}

type EndedPollState = {
    winningAnswers: {
        answer: PollAnswerSubevent;
        voteCount: number;
    }[];
    totalVoteCount: number;
};
const getWinningAnswers = (poll: Poll, responseRelations: Relations): EndedPollState => {
    const userVotes = collectUserVotes(allVotes(responseRelations));
    const votes = countVotes(userVotes, poll.pollEvent);
    const totalVoteCount = [...votes.values()].reduce((sum, vote) => sum + vote, 0);
    const winCount = Math.max(...votes.values());

    return {
        totalVoteCount,
        winningAnswers: poll.pollEvent.answers
            .filter((answer) => votes.get(answer.id) === winCount)
            .map((answer) => ({
                answer,
                voteCount: votes.get(answer.id) || 0,
            })),
    };
};

/**
 * Get deduplicated and validated poll responses
 * Will use cached responses from Poll instance when existing
 * Updates on changes to Poll responses (paging relations or from sync)
 * Returns winning answers and total vote count
 */
const usePollVotes = (poll: Poll): Partial<EndedPollState> => {
    const [results, setResults] = useState({ totalVoteCount: 0 });

    useEffect(() => {
        const getResponses = async (): Promise<void> => {
            const responseRelations = await poll.getResponses();
            setResults(getWinningAnswers(poll, responseRelations));
        };
        const onPollResponses = (responseRelations: Relations): void =>
            setResults(getWinningAnswers(poll, responseRelations));
        poll.on(PollEvent.Responses, onPollResponses);

        getResponses();

        return () => {
            poll.off(PollEvent.Responses, onPollResponses);
        };
    }, [poll]);

    return results;
};

/**
 * Render an ended poll with the winning answer and vote count
 * @param event - the poll start MatrixEvent
 * @param poll - Poll instance
 */
export const PollListItemEnded: React.FC<Props> = ({ event, poll, onClick }) => {
    const pollEvent = poll.pollEvent;
    const { winningAnswers, totalVoteCount } = usePollVotes(poll);
    if (!pollEvent) {
        return null;
    }
    const formattedDate = formatLocalDateShort(event.getTs());

    return (
        <li data-testid={`pollListItem-${event.getId()!}`} className="mx_PollListItemEnded" onClick={onClick}>
            <TooltipTarget label={_t("View poll")} alignment={Alignment.Top}>
                <div className="mx_PollListItemEnded_content">
                    <div className="mx_PollListItemEnded_title">
                        <PollIcon className="mx_PollListItemEnded_icon" />
                        <span className="mx_PollListItemEnded_question">{pollEvent.question.text}</span>
                        <Caption>{formattedDate}</Caption>
                    </div>
                    {!!winningAnswers?.length && (
                        <div className="mx_PollListItemEnded_answers">
                            {winningAnswers?.map(({ answer, voteCount }) => (
                                <PollOption
                                    key={answer.id}
                                    answer={answer}
                                    voteCount={voteCount}
                                    totalVoteCount={totalVoteCount!}
                                    pollId={poll.pollId}
                                    displayVoteCount
                                    isChecked
                                    isEnded
                                />
                            ))}
                        </div>
                    )}
                    <div className="mx_PollListItemEnded_voteCount">
                        <Caption>{_t("Final result based on %(count)s votes", { count: totalVoteCount })}</Caption>
                    </div>
                </div>
            </TooltipTarget>
        </li>
    );
};
