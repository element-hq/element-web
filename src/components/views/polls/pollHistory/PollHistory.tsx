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

import React, { useState } from "react";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { MatrixEvent, Poll, Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import { PollHistoryList } from "./PollHistoryList";
import { PollHistoryFilter } from "./types";
import { PollDetailHeader } from "./PollDetailHeader";
import { PollDetail } from "./PollDetail";
import { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
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
        _t("Poll history")
    );

    return (
        <div className="mx_PollHistory_content">
            {/* @TODO this probably needs some style */}
            <Heading className="mx_PollHistory_header" size="h2">
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
