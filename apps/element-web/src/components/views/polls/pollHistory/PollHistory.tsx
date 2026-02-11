/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";
import { type MatrixClient, type MatrixEvent, type Poll, type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import { PollHistoryList } from "./PollHistoryList";
import { type PollHistoryFilter } from "./types";
import { PollDetailHeader } from "./PollDetailHeader";
import { PollDetail } from "./PollDetail";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { usePollsWithRelations } from "./usePollHistory";
import { useFetchPastPolls } from "./fetchPastPolls";
import Heading from "../../typography/Heading";

type PollHistoryProps = {
    room: Room;
    matrixClient: MatrixClient;
    permalinkCreator: RoomPermalinkCreator;
    onFinished(): void;
};

const sortEventsByLatest = (left: MatrixEvent, right: MatrixEvent): number => right.getTs() - left.getTs();
const filterPolls =
    (filter: PollHistoryFilter) =>
    (poll: Poll): boolean =>
        // exclude polls while they are still loading
        // to avoid jitter in list
        !poll.isFetchingResponses && (filter === "ACTIVE") !== poll.isEnded;

const filterAndSortPolls = (polls: Map<string, Poll>, filter: PollHistoryFilter): MatrixEvent[] => {
    return [...polls.values()]
        .filter(filterPolls(filter))
        .map((poll) => poll.rootEvent)
        .sort(sortEventsByLatest);
};

export const PollHistory: React.FC<PollHistoryProps> = ({ room, matrixClient, permalinkCreator, onFinished }) => {
    const { polls } = usePollsWithRelations(room.roomId, matrixClient);
    const { isLoading, loadMorePolls, oldestEventTimestamp } = useFetchPastPolls(room, matrixClient);
    const [filter, setFilter] = useState<PollHistoryFilter>("ACTIVE");
    const [focusedPollId, setFocusedPollId] = useState<string | null>(null);

    const pollStartEvents = filterAndSortPolls(polls, filter);
    const isLoadingPollResponses = [...polls.values()].some((poll) => poll.isFetchingResponses);

    const focusedPoll = focusedPollId ? polls.get(focusedPollId) : undefined;
    const title = focusedPoll ? (
        <PollDetailHeader filter={filter} onNavigateBack={() => setFocusedPollId(null)} />
    ) : (
        _t("right_panel|polls_button")
    );

    return (
        <div className="mx_PollHistory_content">
            {/* @TODO this probably needs some style */}
            <Heading className="mx_PollHistory_header" size="2">
                {title}
            </Heading>
            {focusedPoll ? (
                <PollDetail poll={focusedPoll} permalinkCreator={permalinkCreator} requestModalClose={onFinished} />
            ) : (
                <PollHistoryList
                    onItemClick={setFocusedPollId}
                    pollStartEvents={pollStartEvents}
                    isLoading={isLoading || isLoadingPollResponses}
                    oldestFetchedEventTimestamp={oldestEventTimestamp}
                    polls={polls}
                    filter={filter}
                    onFilterChange={setFilter}
                    loadMorePolls={loadMorePolls}
                />
            )}
        </div>
    );
};
