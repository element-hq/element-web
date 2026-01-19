/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type Ref, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
    type ISearchResults,
    type IThreadBundledRelationship,
    type MatrixEvent,
    EventTimeline,
    type SearchResult,
    THREAD_RELATION_TYPE,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { SearchIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import ScrollPanel from "./ScrollPanel";
import Spinner from "../views/elements/Spinner";
import AccessibleButton from "../views/elements/AccessibleButton";
import { FilterTabGroup } from "../views/elements/FilterTabGroup";
import { _t, getUserLanguage } from "../../languageHandler";
import { haveRendererForEvent } from "../../events/EventTileFactory";
import SearchResultTile from "../views/rooms/SearchResultTile";
import { searchPagination, SearchScope } from "../../Searching";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import { useScopedRoomContext } from "../../contexts/ScopedRoomContext.tsx";
import EventIndexPeg from "../../indexing/EventIndexPeg";
import { formatFullDateNoDayNoTime } from "../../DateUtils";

const DEBUG = false;
let debuglog = function (msg: string): void {};
const FILE_BATCH_SIZE = 30;
const SHOW_MORE_PAGES = 5;

enum RoomSearchTab {
    Messages = "messages",
    Gallery = "gallery",
    Files = "files",
}

function parseLocalNextBatch(nextBatch?: string): { exhausted: boolean } | null {
    if (!nextBatch) return null;
    try {
        const parsed = JSON.parse(nextBatch);
        if (parsed && typeof parsed === "object" && "exhausted" in parsed) {
            return { exhausted: Boolean((parsed as any).exhausted) };
        }
    } catch {
        // Ignore: server-side next_batch is an opaque string, not JSON.
    }
    return null;
}

function mergeSearchResults(prev: ISearchResults | null, next: ISearchResults): ISearchResults {
    if (!prev) return next;

    const existing = new Map<string, SearchResult>();
    for (const result of prev.results ?? []) {
        const id = result.context.getEvent().getId();
        if (id) existing.set(id, result);
    }

    const merged = [...(prev.results ?? [])];
    for (const result of next.results ?? []) {
        const id = result.context.getEvent().getId();
        if (id && !existing.has(id)) {
            merged.push(result);
        }
    }

    merged.sort((a, b) => {
        const tsDiff = b.context.getEvent().getTs() - a.context.getEvent().getTs();
        if (tsDiff !== 0) return tsDiff;
        const aId = a.context.getEvent().getId() ?? "";
        const bId = b.context.getEvent().getId() ?? "";
        return aId.localeCompare(bId);
    });

    return {
        ...next,
        results: merged,
        count: merged.length,
    };
}

/* istanbul ignore next */
if (DEBUG) {
    // using bind means that we get to keep useful line numbers in the console
    debuglog = logger.log.bind(console);
}

interface Props {
    term: string;
    scope: SearchScope;
    inProgress: boolean;
    promise: Promise<ISearchResults>;
    abortController?: AbortController;
    className: string;
    onUpdate(inProgress: boolean, results: ISearchResults | null, error: Error | null): void;
    ref?: Ref<ScrollPanel>;
}

// XXX: todo: merge overlapping results somehow?
// XXX: why doesn't searching on name work?
export const RoomSearchView = ({
    term,
    scope,
    promise,
    abortController,
    className,
    onUpdate,
    inProgress,
    ref,
}: Props): JSX.Element => {
    const client = useContext(MatrixClientContext);
    const roomContext = useScopedRoomContext("showHiddenEvents", "room", "roomId");
    const roomId = roomContext.roomId;
    const room = roomContext.room;
    const [highlights, setHighlights] = useState<string[] | null>(null);
    const [results, setResults] = useState<ISearchResults | null>(null);
    const resultsRef = useRef<ISearchResults | null>(null);
    const [activeTab, setActiveTab] = useState<RoomSearchTab>(RoomSearchTab.Messages);
    const [isBackfilling, setIsBackfilling] = useState(false);
    const [backfillExhausted, setBackfillExhausted] = useState(false);
    const [fileEvents, setFileEvents] = useState<MatrixEvent[]>([]);
    const [fileCursor, setFileCursor] = useState<string | undefined>(undefined);
    const [fileLoading, setFileLoading] = useState(false);
    const [fileExhausted, setFileExhausted] = useState(false);
    const [fileBackfillExhausted, setFileBackfillExhausted] = useState(false);
    const aborted = useRef(false);
    const isLoadingMore = useRef(false);
    // A map from room ID to permalink creator
    const permalinkCreators = useMemo(() => new Map<string, RoomPermalinkCreator>(), []);
    const innerRef = useRef<ScrollPanel>(null);

    useEffect(() => {
        resultsRef.current = results;
    }, [results]);

    useEffect(() => {
        setActiveTab(RoomSearchTab.Messages);
        setBackfillExhausted(false);
        setIsBackfilling(false);
    }, [term, scope]);

    useEffect(() => {
        setFileEvents([]);
        setFileCursor(undefined);
        setFileExhausted(false);
        setFileBackfillExhausted(false);
    }, [roomId]);

    useEffect(() => {
        return () => {
            permalinkCreators.forEach((pc) => pc.stop());
            permalinkCreators.clear();
        };
    }, [permalinkCreators]);

    const handleSearchResult = useCallback(
        (searchPromise: Promise<ISearchResults>, merge = false): Promise<ISearchResults | null> => {
            onUpdate(true, null, null);

            return searchPromise.then(
                async (results): Promise<ISearchResults | null> => {
                    debuglog("search complete");
                    if (aborted.current) {
                        logger.error("Discarding stale search results");
                        return null;
                    }

                    // postgres on synapse returns us precise details of the strings
                    // which actually got matched for highlighting.
                    //
                    // In either case, we want to highlight the literal search term
                    // whether it was used by the search engine or not.

                    let highlights = results.highlights;
                    if (!highlights.includes(term)) {
                        highlights = highlights.concat(term);
                    }

                    // For overlapping highlights,
                    // favour longer (more specific) terms first
                    highlights = highlights.sort(function (a, b) {
                        return b.length - a.length;
                    });

                    for (const result of results.results) {
                        for (const event of result.context.getTimeline()) {
                            const bundledRelationship = event.getServerAggregatedRelation<IThreadBundledRelationship>(
                                THREAD_RELATION_TYPE.name,
                            );
                            if (!bundledRelationship || event.getThread()) continue;
                            const room = client.getRoom(event.getRoomId());
                            const thread = room?.findThreadForEvent(event);
                            if (thread) {
                                event.setThread(thread);
                            } else {
                                room?.createThread(event.getId()!, event, [], true);
                            }
                        }
                    }

                    setHighlights(highlights);
                    const finalResults = merge ? mergeSearchResults(resultsRef.current, results) : results;
                    setResults({ ...finalResults }); // copy to force a refresh
                    onUpdate(false, finalResults, null);
                    return finalResults;
                },
                (error) => {
                    if (aborted.current) {
                        logger.error("Discarding stale search results");
                        return null;
                    }
                    logger.error("Search failed", error);
                    onUpdate(false, null, error);
                    return null;
                },
            );
        },
        [client, term, onUpdate],
    );

    // Mount & unmount effect
    useEffect(() => {
        aborted.current = false;
        handleSearchResult(promise);
        return () => {
            aborted.current = true;
            abortController?.abort();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const loadMoreFiles = useCallback(async (): Promise<void> => {
        if (!room || fileLoading || fileExhausted) return;
        const eventIndex = EventIndexPeg.get();
        if (!eventIndex) {
            setFileExhausted(true);
            return;
        }

        setFileLoading(true);
        try {
            let backfillExhausted = fileBackfillExhausted;
            let events = await eventIndex.loadFileEvents(room, FILE_BATCH_SIZE, fileCursor, EventTimeline.BACKWARDS);

            // IndexedDB 里还没有足够历史：按需 backfill 再继续拉取（对齐 FluffyChat 的“边加载边显示”）。
            for (let i = 0; i < 3 && events.length < FILE_BATCH_SIZE && !backfillExhausted; i++) {
                const { exhausted, error } = await eventIndex.backfillRoom(room.roomId);
                if (error) {
                    logger.warn("Room files backfill failed", error);
                }
                if (exhausted) {
                    backfillExhausted = true;
                    setFileBackfillExhausted(true);
                    break;
                }

                const more = await eventIndex.loadFileEvents(room, FILE_BATCH_SIZE, fileCursor, EventTimeline.BACKWARDS);
                const seen = new Set(events.map((e) => e.getId()));
                events = [
                    ...events,
                    ...more.filter((e) => {
                        const id = e.getId();
                        if (!id || seen.has(id)) return false;
                        seen.add(id);
                        return true;
                    }),
                ];
            }

            if (events.length > 0) {
                setFileCursor(events[events.length - 1].getId() ?? undefined);
            }
            setFileEvents((prev) => {
                const existing = new Set(prev.map((event) => event.getId()));
                const merged = [...prev];
                for (const event of events) {
                    const id = event.getId();
                    if (!id || existing.has(id)) continue;
                    merged.push(event);
                }
                return merged;
            });
            if (backfillExhausted && events.length < FILE_BATCH_SIZE) {
                setFileExhausted(true);
            }
        } finally {
            setFileLoading(false);
        }
    }, [room, fileLoading, fileExhausted, fileCursor, fileBackfillExhausted]);

    useEffect(() => {
        if (activeTab === RoomSearchTab.Messages) return;
        if (fileEvents.length > 0 || fileLoading || fileExhausted) return;
        void loadMoreFiles();
    }, [activeTab, fileEvents.length, fileLoading, fileExhausted, loadMoreFiles]);

    const onSearchMore = async (): Promise<void> => {
        if (!results || inProgress || isBackfilling || isLoadingMore.current) return;
        isLoadingMore.current = true;

        try {
            let currentResults: ISearchResults = results;
            let lastResultCount = currentResults.results?.length ?? 0;

            const paginateUpTo = async (): Promise<void> => {
                for (let i = 0; i < SHOW_MORE_PAGES; i++) {
                    if (aborted.current) return;
                    const nextBatchInfo = parseLocalNextBatch(currentResults.next_batch);
                    const canPaginate =
                        Boolean(currentResults.next_batch) && (!nextBatchInfo || !nextBatchInfo.exhausted);
                    if (!canPaginate) return;
                    debuglog("requesting more search results");
                    const next = await handleSearchResult(searchPagination(client, currentResults));
                    if (!next) return;
                    const newCount = next.results?.length ?? 0;
                    if (newCount <= lastResultCount) return;
                    lastResultCount = newCount;
                    currentResults = next;
                }
            };

            // 先尽可能多地分页，减少用户点击次数。
            await paginateUpTo();

            if (aborted.current) return;

            const nextBatchInfo = parseLocalNextBatch(currentResults.next_batch);
            const isLocalSearch = Boolean((currentResults as any).seshatQuery);
            const canBackfill =
                isLocalSearch && Boolean(nextBatchInfo?.exhausted) && !backfillExhausted && Boolean(roomId);

            // 本地搜索扫描已到尽头：按需回溯更多历史，再继续分页（对齐 FluffyChat 的“搜索更多”）。
            if (!canBackfill) return;
            const eventIndex = EventIndexPeg.get();
            if (!eventIndex) {
                setBackfillExhausted(true);
                return;
            }

            setIsBackfilling(true);
            const { exhausted, error } = await eventIndex.backfillRoom(roomId!);
            setIsBackfilling(false);

            if (error) {
                logger.warn("Room search backfill failed", error);
            }

            if (exhausted) {
                setBackfillExhausted(true);
                return;
            }

            // 回溯后再次分页，尽量一次补齐更多结果。
            const next = await handleSearchResult(searchPagination(client, currentResults));
            if (next) {
                currentResults = next;
                lastResultCount = currentResults.results?.length ?? lastResultCount;
            }
            await paginateUpTo();
        } finally {
            isLoadingMore.current = false;
        }
    };

    const ret: JSX.Element[] = [
        <li key="search-tabs" className="mx_RoomSearchView_tabs">
            <FilterTabGroup
                name="room-search"
                value={activeTab}
                onFilterChange={setActiveTab}
                tabs={[
                    { id: RoomSearchTab.Messages, label: _t("room|search|tab_messages") },
                    { id: RoomSearchTab.Gallery, label: _t("room|search|tab_gallery") },
                    { id: RoomSearchTab.Files, label: _t("room|search|tab_files") },
                ]}
            />
        </li>,
    ];

    if (inProgress) {
        ret.push(
            <li key="search-spinner">
                <Spinner />
            </li>,
        );
    }

    const onRef = (e: ScrollPanel | null): void => {
        if (typeof ref === "function") {
            ref(e);
        } else if (!!ref) {
            ref.current = e;
        }
        innerRef.current = e;
    };

    if (activeTab === RoomSearchTab.Messages) {
        if (results === null) {
            ret.push(
                <li key="search-loading">
                    <div
                        className="mx_RoomView_messagePanel mx_RoomView_messagePanelSearchSpinner"
                        data-testid="messagePanelSearchSpinner"
                    >
                        <SearchIcon />
                    </div>
                </li>,
            );
        } else {
            const nextBatchInfo = parseLocalNextBatch(results.next_batch);
            const isLocalSearch = Boolean((results as any).seshatQuery);
            const canPaginate = Boolean(results.next_batch) && (!nextBatchInfo || !nextBatchInfo.exhausted);
            const canBackfill = isLocalSearch && !backfillExhausted && Boolean(EventIndexPeg.get()) && Boolean(roomId);
            const canShowMore = canPaginate || canBackfill;

            let lastRoomId: string | undefined;
            const orderedResults = [...(results.results ?? [])].sort((a, b) => {
                const tsDiff = b.context.getEvent().getTs() - a.context.getEvent().getTs();
                if (tsDiff !== 0) return tsDiff;
                const aId = a.context.getEvent().getId() ?? "";
                const bId = b.context.getEvent().getId() ?? "";
                return aId.localeCompare(bId);
            });

            for (const result of orderedResults) {
                const mxEv = result.context.getEvent();
                const resultRoomId = mxEv.getRoomId()!;
                const resultRoom = client.getRoom(resultRoomId);
                if (!resultRoom) {
                    logger.log("Hiding search result from an unknown room", resultRoomId);
                    continue;
                }

                if (!haveRendererForEvent(mxEv, client, roomContext.showHiddenEvents)) continue;

                if (scope === SearchScope.All) {
                    if (resultRoomId !== lastRoomId) {
                        ret.push(
                            <li key={mxEv.getId() + "-room"}>
                                <h2>
                                    {_t("common|room")}: {resultRoom.name}
                                </h2>
                            </li>,
                        );
                        lastRoomId = resultRoomId;
                    }
                }

                let permalinkCreator = permalinkCreators.get(resultRoomId);
                if (!permalinkCreator) {
                    permalinkCreator = new RoomPermalinkCreator(resultRoom);
                    permalinkCreator.start();
                    permalinkCreators.set(resultRoomId, permalinkCreator);
                }

                ret.push(
                    <SearchResultTile
                        key={mxEv.getId()}
                        resultEvent={mxEv}
                        searchHighlights={highlights ?? []}
                        permalinkCreator={permalinkCreator}
                    />,
                );
            }

            if (!results.results?.length && !inProgress && !isBackfilling) {
                ret.push(
                    <li key="search-empty">
                        <h2 className="mx_RoomView_topMarker">{_t("common|no_results")}</h2>
                    </li>,
                );
            }

            if (isBackfilling) {
                ret.push(
                    <li key="search-backfill">
                        <Spinner />
                    </li>,
                );
            }

            if (canShowMore) {
                ret.push(
                    <li key="search-more">
                        <AccessibleButton kind="link_inline" onClick={onSearchMore} disabled={inProgress || isBackfilling}>
                            {_t("common|show_more")}
                        </AccessibleButton>
                    </li>,
                );
            } else if (results.results?.length) {
                ret.push(
                    <li key="search-no-more">
                        <h2 className="mx_RoomView_topMarker">{_t("no_more_results")}</h2>
                    </li>,
                );
            }
        }
    } else {
        const galleryMsgTypes = new Set(["m.image", "m.video"]);
        const fileMsgTypes = new Set(["m.file", "m.audio", "m.video"]);
        const filteredEvents =
            activeTab === RoomSearchTab.Gallery
                ? fileEvents.filter((event) => {
                      const msgtype = event.getContent()?.msgtype;
                      return typeof msgtype === "string" && galleryMsgTypes.has(msgtype);
                  })
                : fileEvents.filter((event) => {
                      const msgtype = event.getContent()?.msgtype;
                      return typeof msgtype === "string" && fileMsgTypes.has(msgtype);
                  });

        const sorted = [...filteredEvents].sort((a, b) => b.getTs() - a.getTs());
        let lastGroupKey: string | undefined;

        for (const event of sorted) {
            const ts = event.getTs();
            const date = new Date(ts);
            const groupKey =
                activeTab === RoomSearchTab.Gallery
                    ? `${date.getFullYear()}-${date.getMonth()}`
                    : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            if (groupKey !== lastGroupKey) {
                const label =
                    activeTab === RoomSearchTab.Gallery
                        ? new Intl.DateTimeFormat(getUserLanguage(), { year: "numeric", month: "long" }).format(date)
                        : formatFullDateNoDayNoTime(date);
                ret.push(
                    <li key={`group-${activeTab}-${groupKey}`} className="mx_RoomSearchView_groupHeader">
                        <div className="mx_RoomSearchView_groupHeaderLabel">{label}</div>
                    </li>,
                );
                lastGroupKey = groupKey;
            }

            const resultRoomId = event.getRoomId()!;
            const resultRoom = client.getRoom(resultRoomId);
            if (!resultRoom) continue;

            const eventId = event.getId() ?? `${resultRoomId}-${event.getTs()}`;
            let permalinkCreator = permalinkCreators.get(resultRoomId);
            if (!permalinkCreator) {
                permalinkCreator = new RoomPermalinkCreator(resultRoom);
                permalinkCreator.start();
                permalinkCreators.set(resultRoomId, permalinkCreator);
            }

            ret.push(
                <SearchResultTile
                    key={eventId}
                    resultEvent={event}
                    permalinkCreator={permalinkCreator}
                    showDateSeparator={false}
                />,
            );
        }

        if (!filteredEvents.length && !fileLoading) {
            ret.push(
                <li key="files-empty">
                    <h2 className="mx_RoomView_topMarker">{_t("common|no_results")}</h2>
                </li>,
            );
        }

        if (fileLoading) {
            ret.push(
                <li key="files-loading">
                    <Spinner />
                </li>,
            );
        }

        if (!fileExhausted) {
            ret.push(
                <li key="files-more">
                    <AccessibleButton kind="link_inline" onClick={loadMoreFiles} disabled={fileLoading}>
                        {_t("common|show_more")}
                    </AccessibleButton>
                </li>,
            );
        } else if (filteredEvents.length) {
            ret.push(
                <li key="files-no-more">
                    <h2 className="mx_RoomView_topMarker">{_t("no_more_results")}</h2>
                </li>,
            );
        }
    }

    return (
        <ScrollPanel ref={onRef} className={"mx_RoomView_searchResultsPanel " + className}>
            <li className="mx_RoomView_scrollheader" />
            {ret}
        </ScrollPanel>
    );
};
