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

import { useCallback, useEffect, useState } from "react";
import { M_POLL_START } from "matrix-js-sdk/src/@types/polls";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Direction, EventTimeline, EventTimelineSet, Room } from "matrix-js-sdk/src/matrix";
import { Filter, IFilterDefinition } from "matrix-js-sdk/src/filter";
import { logger } from "matrix-js-sdk/src/logger";

const getOldestEventTimestamp = (timelineSet?: EventTimelineSet): number | undefined => {
    if (!timelineSet) {
        return;
    }

    const liveTimeline = timelineSet?.getLiveTimeline();
    const events = liveTimeline.getEvents();
    return events[0]?.getTs();
};

/**
 * Page backwards in timeline history
 * @param timelineSet - timelineset to page
 * @param matrixClient - client
 * @param canPageBackward - whether the timeline has more pages
 * @param oldestEventTimestamp - server ts of the oldest encountered event
 */
const pagePollHistory = async (
    timelineSet: EventTimelineSet,
    matrixClient: MatrixClient,
): Promise<{
    oldestEventTimestamp?: number;
    canPageBackward: boolean;
}> => {
    if (!timelineSet) {
        return { canPageBackward: false };
    }

    const liveTimeline = timelineSet.getLiveTimeline();

    await matrixClient.paginateEventTimeline(liveTimeline, {
        backwards: true,
    });

    return {
        oldestEventTimestamp: getOldestEventTimestamp(timelineSet),
        canPageBackward: !!liveTimeline.getPaginationToken(EventTimeline.BACKWARDS),
    };
};

/**
 * Page timeline backwards until either:
 * - event older than timestamp is encountered
 * - end of timeline is reached
 * @param timelineSet - timeline set to page
 * @param matrixClient - client
 * @param timestamp - epoch timestamp to page until
 * @param canPageBackward - whether the timeline has more pages
 * @param oldestEventTimestamp - server ts of the oldest encountered event
 */
const fetchHistoryUntilTimestamp = async (
    timelineSet: EventTimelineSet | undefined,
    matrixClient: MatrixClient,
    timestamp: number,
    canPageBackward: boolean,
    oldestEventTimestamp?: number,
): Promise<void> => {
    if (!timelineSet || !canPageBackward || (oldestEventTimestamp && oldestEventTimestamp < timestamp)) {
        return;
    }
    const result = await pagePollHistory(timelineSet, matrixClient);

    return fetchHistoryUntilTimestamp(
        timelineSet,
        matrixClient,
        timestamp,
        result.canPageBackward,
        result.oldestEventTimestamp,
    );
};

const ONE_DAY_MS = 60000 * 60 * 24;
/**
 * Fetches timeline history for given number of days in past
 * @param timelineSet - timelineset to page
 * @param matrixClient - client
 * @param historyPeriodDays - number of days of history to fetch, from current day
 * @returns isLoading - true while fetching
 * @returns oldestEventTimestamp - timestamp of oldest encountered poll, undefined when no polls found in timeline so far
 * @returns loadMorePolls - function to page timeline backwards, undefined when timeline cannot be paged backwards
 * @returns loadTimelineHistory - loads timeline history for the given history period
 */
const useTimelineHistory = (
    timelineSet: EventTimelineSet | undefined,
    matrixClient: MatrixClient,
    historyPeriodDays: number,
): {
    isLoading: boolean;
    oldestEventTimestamp?: number;
    loadTimelineHistory: () => Promise<void>;
    loadMorePolls?: () => Promise<void>;
} => {
    const [isLoading, setIsLoading] = useState(true);
    const [oldestEventTimestamp, setOldestEventTimestamp] = useState<number | undefined>(undefined);
    const [canPageBackward, setCanPageBackward] = useState(false);

    const loadTimelineHistory = useCallback(async () => {
        const endOfHistoryPeriodTimestamp = Date.now() - ONE_DAY_MS * historyPeriodDays;
        setIsLoading(true);
        try {
            const liveTimeline = timelineSet?.getLiveTimeline();
            const canPageBackward = !!liveTimeline?.getPaginationToken(Direction.Backward);
            const oldestEventTimestamp = getOldestEventTimestamp(timelineSet);

            await fetchHistoryUntilTimestamp(
                timelineSet,
                matrixClient,
                endOfHistoryPeriodTimestamp,
                canPageBackward,
                oldestEventTimestamp,
            );

            setCanPageBackward(!!timelineSet?.getLiveTimeline()?.getPaginationToken(EventTimeline.BACKWARDS));
            setOldestEventTimestamp(getOldestEventTimestamp(timelineSet));
        } catch (error) {
            logger.error("Failed to fetch room polls history", error);
        } finally {
            setIsLoading(false);
        }
    }, [historyPeriodDays, timelineSet, matrixClient]);

    const loadMorePolls = useCallback(async () => {
        if (!timelineSet) {
            return;
        }
        setIsLoading(true);
        try {
            const result = await pagePollHistory(timelineSet, matrixClient);

            setCanPageBackward(result.canPageBackward);
            setOldestEventTimestamp(result.oldestEventTimestamp);
        } catch (error) {
            logger.error("Failed to fetch room polls history", error);
        } finally {
            setIsLoading(false);
        }
    }, [timelineSet, matrixClient]);

    return {
        isLoading,
        oldestEventTimestamp,
        loadTimelineHistory,
        loadMorePolls: canPageBackward ? loadMorePolls : undefined,
    };
};

const filterDefinition: IFilterDefinition = {
    room: {
        timeline: {
            types: [M_POLL_START.name, M_POLL_START.altName],
        },
    },
};

/**
 * Fetches poll start events in the last N days of room history
 * @param room - room to fetch history for
 * @param matrixClient - client
 * @param historyPeriodDays - number of days of history to fetch, from current day
 * @returns isLoading - true while fetching history
 * @returns oldestEventTimestamp - timestamp of oldest encountered poll, undefined when no polls found in timeline so far
 * @returns loadMorePolls - function to page timeline backwards, undefined when timeline cannot be paged backwards
 */
export const useFetchPastPolls = (
    room: Room,
    matrixClient: MatrixClient,
    historyPeriodDays = 30,
): {
    isLoading: boolean;
    oldestEventTimestamp?: number;
    loadMorePolls?: () => Promise<void>;
} => {
    const [timelineSet, setTimelineSet] = useState<EventTimelineSet | undefined>(undefined);

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

    const { isLoading, oldestEventTimestamp, loadMorePolls, loadTimelineHistory } = useTimelineHistory(
        timelineSet,
        matrixClient,
        historyPeriodDays,
    );

    useEffect(() => {
        loadTimelineHistory();
    }, [loadTimelineHistory]);

    return { isLoading, oldestEventTimestamp, loadMorePolls };
};
