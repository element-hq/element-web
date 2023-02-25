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

import { useEffect, useState } from "react";
import { M_POLL_START } from "matrix-js-sdk/src/@types/polls";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { EventTimeline, EventTimelineSet, Room } from "matrix-js-sdk/src/matrix";
import { Filter, IFilterDefinition } from "matrix-js-sdk/src/filter";
import { logger } from "matrix-js-sdk/src/logger";

/**
 * Page timeline backwards until either:
 * - event older than endOfHistoryPeriodTimestamp is encountered
 * - end of timeline is reached
 * @param timelineSet - timelineset to page
 * @param matrixClient - client
 * @param endOfHistoryPeriodTimestamp - epoch timestamp to fetch until
 * @returns void
 */
const pagePolls = async (
    timelineSet: EventTimelineSet,
    matrixClient: MatrixClient,
    endOfHistoryPeriodTimestamp: number,
): Promise<void> => {
    const liveTimeline = timelineSet.getLiveTimeline();
    const events = liveTimeline.getEvents();
    const oldestEventTimestamp = events[0]?.getTs() || Date.now();
    const hasMorePages = !!liveTimeline.getPaginationToken(EventTimeline.BACKWARDS);

    if (!hasMorePages || oldestEventTimestamp <= endOfHistoryPeriodTimestamp) {
        return;
    }

    await matrixClient.paginateEventTimeline(liveTimeline, {
        backwards: true,
    });

    return pagePolls(timelineSet, matrixClient, endOfHistoryPeriodTimestamp);
};

const ONE_DAY_MS = 60000 * 60 * 24;
/**
 * Fetches timeline history for given number of days in past
 * @param timelineSet - timelineset to page
 * @param matrixClient - client
 * @param historyPeriodDays - number of days of history to fetch, from current day
 * @returns isLoading - true while fetching history
 */
const useTimelineHistory = (
    timelineSet: EventTimelineSet | null,
    matrixClient: MatrixClient,
    historyPeriodDays: number,
): { isLoading: boolean } => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!timelineSet) {
            return;
        }
        const endOfHistoryPeriodTimestamp = Date.now() - ONE_DAY_MS * historyPeriodDays;

        const doFetchHistory = async (): Promise<void> => {
            setIsLoading(true);
            try {
                await pagePolls(timelineSet, matrixClient, endOfHistoryPeriodTimestamp);
            } catch (error) {
                logger.error("Failed to fetch room polls history", error);
            } finally {
                setIsLoading(false);
            }
        };
        doFetchHistory();
    }, [timelineSet, historyPeriodDays, matrixClient]);

    return { isLoading };
};

const filterDefinition: IFilterDefinition = {
    room: {
        timeline: {
            types: [M_POLL_START.name, M_POLL_START.altName],
        },
    },
};

/**
 * Fetch poll start events in the last N days of room history
 * @param room - room to fetch history for
 * @param matrixClient - client
 * @param historyPeriodDays - number of days of history to fetch, from current day
 * @returns isLoading - true while fetching history
 */
export const useFetchPastPolls = (
    room: Room,
    matrixClient: MatrixClient,
    historyPeriodDays = 30,
): { isLoading: boolean } => {
    const [timelineSet, setTimelineSet] = useState<EventTimelineSet | null>(null);

    useEffect(() => {
        const filter = new Filter(matrixClient.getSafeUserId());
        filter.setDefinition(filterDefinition);
        const getFilteredTimelineSet = async (): Promise<void> => {
            const filterId = await matrixClient.getOrCreateFilter(`POLL_HISTORY_FILTER_${room.roomId}}`, filter);
            filter.filterId = filterId;
            const timelineSet = room.getOrCreateFilteredTimelineSet(filter);
            setTimelineSet(timelineSet);
        };

        getFilteredTimelineSet();
    }, [room, matrixClient]);

    const { isLoading } = useTimelineHistory(timelineSet, matrixClient, historyPeriodDays);

    return { isLoading };
};
