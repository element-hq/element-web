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
import { MatrixEvent, Poll } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import BaseDialog from "../BaseDialog";
import { IDialogProps } from "../IDialogProps";
import { PollHistoryList } from "./PollHistoryList";
import { PollHistoryFilter } from "./types";
import { usePollsWithRelations } from "./usePollHistory";
import { useFetchPastPolls } from "./fetchPastPolls";

type PollHistoryDialogProps = Pick<IDialogProps, "onFinished"> & {
    roomId: string;
    matrixClient: MatrixClient;
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

export const PollHistoryDialog: React.FC<PollHistoryDialogProps> = ({ roomId, matrixClient, onFinished }) => {
    const room = matrixClient.getRoom(roomId)!;
    const { isLoading } = useFetchPastPolls(room, matrixClient);
    const { polls } = usePollsWithRelations(roomId, matrixClient);
    const [filter, setFilter] = useState<PollHistoryFilter>("ACTIVE");

    const pollStartEvents = filterAndSortPolls(polls, filter);
    const isLoadingPollResponses = [...polls.values()].some((poll) => poll.isFetchingResponses);

    return (
        <BaseDialog title={_t("Polls history")} onFinished={onFinished}>
            <div className="mx_PollHistoryDialog_content">
                <PollHistoryList
                    pollStartEvents={pollStartEvents}
                    isLoading={isLoading || isLoadingPollResponses}
                    polls={polls}
                    filter={filter}
                    onFilterChange={setFilter}
                />
            </div>
        </BaseDialog>
    );
};
