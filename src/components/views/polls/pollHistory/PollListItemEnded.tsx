/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useState } from "react";
import { type PollAnswerSubevent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { type MatrixEvent, type Poll, PollEvent, type Relations } from "matrix-js-sdk/src/matrix";
import { Tooltip } from "@vector-im/compound-web";

import { Icon as PollIcon } from "../../../../../res/img/element-icons/room/composer/poll.svg";
import { _t } from "../../../../languageHandler";
import { formatLocalDateShort } from "../../../../DateUtils";
import { allVotes, collectUserVotes, countVotes } from "../../messages/MPollBody";
import { PollOption } from "../../polls/PollOption";
import { Caption } from "../../typography/Caption";

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
            <Tooltip label={_t("right_panel|poll|view_poll")} placement="top" isTriggerInteractive={false}>
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
                        <Caption>{_t("right_panel|poll|final_result", { count: totalVoteCount })}</Caption>
                    </div>
                </div>
            </Tooltip>
        </li>
    );
};
