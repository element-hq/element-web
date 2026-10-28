/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useEffect, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import {
    M_POLL_RESPONSE,
    M_POLL_START,
    PollEvent,
    type MatrixEvent,
    type Poll,
    type Relations,
} from "matrix-js-sdk/src/matrix";
import { type PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { PollResponseEvent } from "matrix-js-sdk/src/extensible_events_v1/PollResponseEvent";

import { formatList } from "./FormattingUtils";
import { useMatrixClientContext } from "../contexts/MatrixClientContext";
import { useTypedEventEmitter } from "../hooks/useEventEmitter";

export class UserVote {
    public constructor(
        public readonly ts: number,
        public readonly sender: string,
        public readonly answers: string[],
    ) {}
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
        return voteRelations
            .getRelations()
            .filter((e) => !e.isRedacted())
            .map(userResponseFromPollResponseEvent);
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
    userId?: string | null,
    selected?: string | null,
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

/**
 * Works out the answer(s) with the most votes in a poll.
 * @param pollEvent The poll start event
 * @param voteRelations The vote (response) events for the poll
 * @returns The top answer(s) as a formatted list, or an empty string if there is no top answer
 */
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

    return formatList(bestAnswerTexts, 3);
}

/**
 * Works out the top answer of the poll that the given poll end event refers to, from the votes this client has seen.
 * @param pollEndEvent The poll end event
 * @returns The top answer(s), an empty string if nobody voted, or undefined until the poll and its votes have loaded
 */
export function usePollTopAnswer(pollEndEvent: MatrixEvent): string | undefined {
    const cli = useMatrixClientContext();
    const room = cli.getRoom(pollEndEvent.getRoomId());
    const pollId = pollEndEvent.relationEventId;
    const [poll, setPoll] = useState<Poll | undefined>(() => (pollId ? room?.polls.get(pollId) : undefined));
    const [topAnswer, setTopAnswer] = useState<string>();

    // The poll start event may not have been processed yet
    useTypedEventEmitter(room ?? undefined, PollEvent.New, (newPoll: Poll) => {
        if (newPoll.pollId === pollId) setPoll(newPoll);
    });

    useEffect(() => {
        if (!poll) return;
        let unmounted = false;
        const onResponses = (responses: Relations): void => {
            // Only count once every vote has been fetched and late votes have been discarded by the poll ending
            if (unmounted || !poll.isEnded || poll.isFetchingResponses) return;
            setTopAnswer(findTopAnswer(poll.rootEvent, responses));
        };
        poll.on(PollEvent.Responses, onResponses);
        void poll.getResponses().then(onResponses);
        return () => {
            unmounted = true;
            poll.off(PollEvent.Responses, onResponses);
        };
    }, [poll]);

    return topAnswer;
}
