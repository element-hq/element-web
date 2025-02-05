/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";
import { type MatrixEvent, type Poll } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import { FilterTabGroup } from "../../elements/FilterTabGroup";
import InlineSpinner from "../../elements/InlineSpinner";
import { type PollHistoryFilter } from "./types";
import { PollListItem } from "./PollListItem";
import { PollListItemEnded } from "./PollListItemEnded";
import AccessibleButton from "../../elements/AccessibleButton";

const LoadingPolls: React.FC<{ noResultsYet?: boolean }> = ({ noResultsYet }) => (
    <div
        className={classNames("mx_PollHistoryList_loading", {
            mx_PollHistoryList_noResultsYet: noResultsYet,
        })}
    >
        <InlineSpinner />
        {_t("right_panel|poll|loading")}
    </div>
);

const LoadMorePolls: React.FC<{ loadMorePolls?: () => void; isLoading?: boolean }> = ({ isLoading, loadMorePolls }) =>
    loadMorePolls ? (
        <AccessibleButton
            className="mx_PollHistoryList_loadMorePolls"
            kind="link_inline"
            onClick={() => loadMorePolls()}
        >
            {_t("right_panel|poll|load_more")}
            {isLoading && <InlineSpinner />}
        </AccessibleButton>
    ) : null;

const ONE_DAY_MS = 60000 * 60 * 24;
const getNoResultsMessage = (
    filter: PollHistoryFilter,
    oldestEventTimestamp?: number,
    loadMorePolls?: () => void,
): string => {
    if (!loadMorePolls) {
        return filter === "ACTIVE" ? _t("right_panel|poll|empty_active") : _t("right_panel|poll|empty_past");
    }

    // we don't know how much history has been fetched
    if (!oldestEventTimestamp) {
        return filter === "ACTIVE"
            ? _t("right_panel|poll|empty_active_load_more")
            : _t("right_panel|poll|empty_past_load_more");
    }

    const fetchedHistoryDaysCount = Math.ceil((Date.now() - oldestEventTimestamp) / ONE_DAY_MS);
    return filter === "ACTIVE"
        ? _t("right_panel|poll|empty_active_load_more_n_days", { count: fetchedHistoryDaysCount })
        : _t("right_panel|poll|empty_past_load_more_n_days", {
              count: fetchedHistoryDaysCount,
          });
};

const NoResults: React.FC<{
    filter: PollHistoryFilter;
    oldestFetchedEventTimestamp?: number;
    loadMorePolls?: () => void;
    isLoading?: boolean;
}> = ({ filter, isLoading, oldestFetchedEventTimestamp, loadMorePolls }) => {
    // we can't page the timeline anymore
    // just use plain loader
    if (!loadMorePolls && isLoading) {
        return <LoadingPolls noResultsYet />;
    }

    return (
        <span className="mx_PollHistoryList_noResults">
            {getNoResultsMessage(filter, oldestFetchedEventTimestamp, loadMorePolls)}

            {!!loadMorePolls && <LoadMorePolls loadMorePolls={loadMorePolls} isLoading={isLoading} />}
        </span>
    );
};

type PollHistoryListProps = {
    pollStartEvents: MatrixEvent[];
    polls: Map<string, Poll>;
    filter: PollHistoryFilter;
    /**
     * server ts of the oldest fetched poll
     * ignoring filter
     * used to render no results in last x days message
     * undefined when no polls are found
     */
    oldestFetchedEventTimestamp?: number;
    onFilterChange: (filter: PollHistoryFilter) => void;
    onItemClick: (pollId: string) => void;
    loadMorePolls?: () => void;
    isLoading?: boolean;
};
export const PollHistoryList: React.FC<PollHistoryListProps> = ({
    pollStartEvents,
    polls,
    filter,
    isLoading,
    oldestFetchedEventTimestamp,
    onFilterChange,
    loadMorePolls,
    onItemClick,
}) => {
    return (
        <div className="mx_PollHistoryList">
            <FilterTabGroup<PollHistoryFilter>
                name="PollHistory_filter"
                value={filter}
                onFilterChange={onFilterChange}
                tabs={[
                    { id: "ACTIVE", label: "Active polls" },
                    { id: "ENDED", label: "Past polls" },
                ]}
            />
            {!!pollStartEvents.length && (
                <ol className={classNames("mx_PollHistoryList_list", `mx_PollHistoryList_list_${filter}`)}>
                    {pollStartEvents.map((pollStartEvent) =>
                        filter === "ACTIVE" ? (
                            <PollListItem
                                key={pollStartEvent.getId()!}
                                event={pollStartEvent}
                                onClick={() => onItemClick(pollStartEvent.getId()!)}
                            />
                        ) : (
                            <PollListItemEnded
                                key={pollStartEvent.getId()!}
                                event={pollStartEvent}
                                poll={polls.get(pollStartEvent.getId()!)!}
                                onClick={() => onItemClick(pollStartEvent.getId()!)}
                            />
                        ),
                    )}
                    {isLoading && !loadMorePolls && <LoadingPolls />}
                    {!!loadMorePolls && <LoadMorePolls loadMorePolls={loadMorePolls} isLoading={isLoading} />}
                </ol>
            )}
            {!pollStartEvents.length && (
                <NoResults
                    oldestFetchedEventTimestamp={oldestFetchedEventTimestamp}
                    isLoading={isLoading}
                    filter={filter}
                    loadMorePolls={loadMorePolls}
                />
            )}
        </div>
    );
};
