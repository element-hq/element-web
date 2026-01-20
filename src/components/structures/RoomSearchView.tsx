/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type Ref, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
    type ISearchResults,
    type IThreadBundledRelationship,
    type MatrixEvent,
    type Room,
    type SearchResult,
    THREAD_RELATION_TYPE,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { SearchIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import ChevronRightIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-right";
import { IconButton } from "@vector-im/compound-web";

import ScrollPanel from "./ScrollPanel";
import Spinner from "../views/elements/Spinner";
import AccessibleButton from "../views/elements/AccessibleButton";
import MemberAvatar from "../views/avatars/MemberAvatar";
import { _t } from "../../languageHandler";
import { haveRendererForEvent } from "../../events/EventTileFactory";
import { searchPagination, SearchScope } from "../../Searching";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import SettingsStore from "../../settings/SettingsStore";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { useScopedRoomContext } from "../../contexts/ScopedRoomContext.tsx";
import EventIndexPeg from "../../indexing/EventIndexPeg";
import { formatFullDateNoDayNoTime, formatTime } from "../../DateUtils";

const DEBUG = false;
let debuglog = function (msg: string): void {};
// 手动点击“显示更多”时更积极地向更早历史推进，减少“点了没变化”的体感。
const MANUAL_SHOW_MORE_PAGES = 50;
const AUTO_SHOW_MORE_PAGES = 3;
// 每次回溯索引拉取的事件数：适当增大以减少“找不到更早消息”的情况（尤其是高活跃群）。
const ROOM_SEARCH_BACKFILL_LIMIT = 1000;

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

const TEXT_MESSAGE_TYPES = new Set(["m.text", "m.notice", "m.emote"]);
const SNIPPET_CONTEXT_BEFORE = 30;
const SNIPPET_CONTEXT_AFTER = 80;
const SNIPPET_FALLBACK_LENGTH = 120;

function getSearchableMessageBody(event: MatrixEvent): string | null {
    if (event.getType() !== "m.room.message") return null;
    const content = event.getContent() as any;
    const msgtype = content?.msgtype;
    if (typeof msgtype !== "string" || !TEXT_MESSAGE_TYPES.has(msgtype)) return null;
    const body = content?.body;
    if (typeof body !== "string" || !body.trim()) return null;
    return body;
}

function buildSnippet(body: string, highlights: string[]): { snippet: string; prefixEllipsis: boolean; suffixEllipsis: boolean } {
    const normalised = body.replace(/\s+/g, " ").trim();
    if (!normalised) return { snippet: "", prefixEllipsis: false, suffixEllipsis: false };

    const lower = normalised.toLowerCase();
    const terms = (highlights ?? [])
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => h.toLowerCase());

    let matchIndex = -1;
    let matchLength = 0;
    for (const term of terms) {
        const idx = term ? lower.indexOf(term) : -1;
        if (idx === -1) continue;
        if (matchIndex === -1 || idx < matchIndex || (idx === matchIndex && term.length > matchLength)) {
            matchIndex = idx;
            matchLength = term.length;
        }
    }

    if (matchIndex === -1) {
        const snippet = normalised.slice(0, SNIPPET_FALLBACK_LENGTH);
        return {
            snippet,
            prefixEllipsis: false,
            suffixEllipsis: snippet.length < normalised.length,
        };
    }

    const start = Math.max(0, matchIndex - SNIPPET_CONTEXT_BEFORE);
    const end = Math.min(normalised.length, matchIndex + matchLength + SNIPPET_CONTEXT_AFTER);
    const snippet = normalised.slice(start, end);
    return {
        snippet,
        prefixEllipsis: start > 0,
        suffixEllipsis: end < normalised.length,
    };
}

function renderHighlightedText(text: string, highlights: string[]): React.ReactNode {
    const terms = (highlights ?? []).map((h) => h.trim()).filter(Boolean);
    if (!terms.length || !text) return text;

    const textLower = text.toLowerCase();
    const termsLower = terms.map((t) => t.toLowerCase());

    const nodes: React.ReactNode[] = [];
    let pos = 0;
    while (pos < text.length) {
        let bestStart = -1;
        let bestEnd = -1;
        let bestTermLen = 0;

        for (let i = 0; i < termsLower.length; i++) {
            const term = termsLower[i];
            if (!term) continue;
            const idx = textLower.indexOf(term, pos);
            if (idx === -1) continue;
            const end = idx + term.length;
            if (bestStart === -1 || idx < bestStart || (idx === bestStart && term.length > bestTermLen)) {
                bestStart = idx;
                bestEnd = end;
                bestTermLen = term.length;
            }
        }

        if (bestStart === -1 || bestEnd === -1) {
            nodes.push(text.slice(pos));
            break;
        }

        if (bestStart > pos) {
            nodes.push(text.slice(pos, bestStart));
        }

        nodes.push(
            <span key={`hl-${bestStart}-${bestEnd}`} className="mx_EventTile_searchHighlight">
                {text.slice(bestStart, bestEnd)}
            </span>,
        );
        pos = bestEnd;
    }

    return nodes;
}

function jumpToEvent(roomId: string | undefined, eventId: string): void {
    dis.dispatch<ViewRoomPayload>({
        action: Action.ViewRoom,
        event_id: eventId,
        highlighted: true,
        room_id: roomId,
        metricsTrigger: undefined,
    });
}

function RoomSearchMessageResultItem({
    event,
    room,
    highlights,
}: {
    event: MatrixEvent;
    room: Room;
    highlights: string[];
}): JSX.Element | null {
    const eventId = event.getId();
    if (!eventId) return null;

    const senderId = event.getSender() ?? "";
    const member = room.getMember(senderId) ?? null;
    const body = getSearchableMessageBody(event);
    if (!body) return null;

    const { snippet, prefixEllipsis, suffixEllipsis } = buildSnippet(body, highlights);
    const isTwelveHour = Boolean(SettingsStore.getValue("showTwelveHourTimestamps"));
    const time = formatTime(new Date(event.getTs()), isTwelveHour);

    const onJumpToEvent = (ev: React.MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        jumpToEvent(event.getRoomId(), eventId);
    };

    return (
        <li data-scroll-tokens={eventId} className="mx_RoomSearchResultItem">
            <div className="mx_RoomSearchResultItem_time">{time}</div>
            <MemberAvatar
                className="mx_RoomSearchResultItem_avatar"
                member={member}
                fallbackUserId={senderId}
                size="32px"
                hideTitle
            />
            <div className="mx_RoomSearchResultItem_content">
                <div className="mx_RoomSearchResultItem_sender">{member?.name ?? senderId}</div>
                <div className="mx_RoomSearchResultItem_snippet">
                    {prefixEllipsis ? "…" : null}
                    {renderHighlightedText(snippet, highlights)}
                    {suffixEllipsis ? "…" : null}
                </div>
            </div>
            <IconButton
                className="mx_RoomSearchResultItem_jump"
                aria-label={_t("timeline|mab|view_in_room")}
                title={_t("timeline|mab|view_in_room")}
                onClick={onJumpToEvent}
            >
                <ChevronRightIcon />
            </IconButton>
        </li>
    );
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
    const [highlights, setHighlights] = useState<string[] | null>(null);
    const [results, setResults] = useState<ISearchResults | null>(null);
    const resultsRef = useRef<ISearchResults | null>(null);
    const [isBackfilling, setIsBackfilling] = useState(false);
    const [backfillExhausted, setBackfillExhausted] = useState(false);
    const [isPaginating, setIsPaginating] = useState(false);
    const aborted = useRef(false);
    const isLoadingMore = useRef(false);

    useEffect(() => {
        resultsRef.current = results;
    }, [results]);

    useEffect(() => {
        setBackfillExhausted(false);
        setIsBackfilling(false);
    }, [term, scope]);

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
        // 理论上 promise 一定存在（由 RoomView.onSearch 构造）。
        // 但在极端竞态（例如搜索被取消后仍收到异步更新）下，可能出现 search state 被错误“复活”
        // 且缺少 promise 的情况。这里加一层防御，避免 `.then` 访问 undefined 触发白屏。
        const maybePromise: unknown = promise;
        if (maybePromise && typeof (maybePromise as any).then === "function") {
            handleSearchResult(maybePromise as Promise<ISearchResults>);
        } else {
            logger.error("Search initialisation failed: missing search promise");
            onUpdate(false, null, new Error("Search initialisation failed"));
        }
        return () => {
            aborted.current = true;
            abortController?.abort();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const loadMoreMessages = useCallback(async (pages: number): Promise<boolean> => {
        const baseResults = resultsRef.current;
        if (!baseResults || inProgress || isBackfilling || isLoadingMore.current) return false;
        isLoadingMore.current = true;
        setIsPaginating(true);

        try {
            let currentResults: ISearchResults = baseResults;
            const baseCount = currentResults.results?.length ?? 0;
            let lastResultCount = baseCount;

            const paginateUpTo = async (maxPages: number): Promise<void> => {
                let pagesAfterFirstHitRemaining = 0;
                for (let i = 0; i < maxPages; i++) {
                    if (aborted.current) return;
                    const prevNextBatch = currentResults.next_batch;
                    const nextBatchInfo = parseLocalNextBatch(prevNextBatch);
                    const canPaginate =
                        Boolean(currentResults.next_batch) && (!nextBatchInfo || !nextBatchInfo.exhausted);
                    if (!canPaginate) return;
                    debuglog("requesting more search results");
                    const next = await handleSearchResult(searchPagination(client, currentResults), true);
                    if (!next) return;
                    const newCount = next.results?.length ?? 0;
                    const nextNextBatch = next.next_batch;

                    // 本地搜索可能会出现“本页无新增匹配，但扫描游标已推进”的情况：
                    // 例如连续 MAX_SCAN_RECORDS 条都不包含关键字，此时 results 不增长但 next_batch.key 会变。
                    // 如果我们在这里直接停止，会导致无法继续向更老历史推进，从而表现为“显示更多没反应/搜不到更早消息”。
                    if (newCount > lastResultCount) {
                        lastResultCount = newCount;
                        // 命中到新结果后，再额外多扫几页，让用户一次看到“更多”而不是只多 1 条。
                        if (pagesAfterFirstHitRemaining === 0) {
                            pagesAfterFirstHitRemaining = Math.min(5, maxPages - i - 1);
                        }
                    } else if (pagesAfterFirstHitRemaining > 0) {
                        pagesAfterFirstHitRemaining -= 1;
                        if (pagesAfterFirstHitRemaining === 0) {
                            currentResults = next;
                            return;
                        }
                    }
                    if (nextNextBatch === prevNextBatch && newCount <= lastResultCount) return;
                    currentResults = next;
                }
            };

            // 先尽可能多地分页，减少用户等待/点击次数。
            await paginateUpTo(pages);

            if (aborted.current) return lastResultCount > baseCount;

            const nextBatchInfo = parseLocalNextBatch(currentResults.next_batch);
            const isLocalSearch = Boolean((currentResults as any).seshatQuery);
            const canBackfill =
                isLocalSearch && Boolean(nextBatchInfo?.exhausted) && !backfillExhausted && Boolean(roomId);

            // 本地搜索扫描已到尽头：按需回溯更多历史，再继续分页（对齐 FluffyChat 的“搜索更多”）。
            if (!canBackfill) return lastResultCount > baseCount;
            const eventIndex = EventIndexPeg.get();
            if (!eventIndex) {
                setBackfillExhausted(true);
                return lastResultCount > baseCount;
            }

            setIsBackfilling(true);
            const { exhausted, error } = await eventIndex.backfillRoom(roomId!, ROOM_SEARCH_BACKFILL_LIMIT);
            setIsBackfilling(false);

            if (error) {
                logger.warn("Room search backfill failed", error);
            }

            if (exhausted) {
                setBackfillExhausted(true);
                return lastResultCount > baseCount;
            }

            // 回溯后再次分页，尽量一次补齐更多结果。
            const next = await handleSearchResult(searchPagination(client, currentResults), true);
            if (next) {
                currentResults = next;
                lastResultCount = currentResults.results?.length ?? lastResultCount;
            }
            await paginateUpTo(pages);
            return lastResultCount > baseCount;
        } finally {
            isLoadingMore.current = false;
            setIsPaginating(false);
        }
    }, [inProgress, isBackfilling, backfillExhausted, roomId, client, handleSearchResult]);

    const onSearchMore = useCallback(async (): Promise<void> => {
        await loadMoreMessages(MANUAL_SHOW_MORE_PAGES);
    }, [loadMoreMessages]);

    const onFillRequest = useCallback(
        async (backwards: boolean): Promise<boolean> => {
            if (backwards) return false;

            const currentResults = resultsRef.current;
            if (!currentResults) return false;

            const nextBatchInfo = parseLocalNextBatch(currentResults.next_batch);
            const isLocalSearch = Boolean((currentResults as any).seshatQuery);
            const canPaginate = Boolean(currentResults.next_batch) && (!nextBatchInfo || !nextBatchInfo.exhausted);
            const canBackfill = isLocalSearch && !backfillExhausted && Boolean(EventIndexPeg.get()) && Boolean(roomId);
            if (!canPaginate && !canBackfill) return false;

            return loadMoreMessages(AUTO_SHOW_MORE_PAGES);
        },
        [backfillExhausted, roomId, loadMoreMessages],
    );

    const ret: JSX.Element[] = [];

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
    };

    if (results === null) {
        ret.push(
            <li key="search-loading">
                <div className="mx_RoomView_messagePanel mx_RoomView_messagePanelSearchSpinner" data-testid="messagePanelSearchSpinner">
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
        let lastGroupKey: string | undefined;
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
                    lastGroupKey = undefined;
                }
            }

            const body = getSearchableMessageBody(mxEv);
            if (!body) continue;

            const ts = mxEv.getTs();
            const date = new Date(ts);
            const groupKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            if (groupKey !== lastGroupKey) {
                ret.push(
                    <li key={`group-${resultRoomId}-${groupKey}`} className="mx_RoomSearchView_groupHeader">
                        <div className="mx_RoomSearchView_groupHeaderLabel">{formatFullDateNoDayNoTime(date)}</div>
                    </li>,
                );
                lastGroupKey = groupKey;
            }

            ret.push(
                <RoomSearchMessageResultItem
                    key={mxEv.getId()}
                    event={mxEv}
                    room={resultRoom}
                    highlights={highlights ?? []}
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

        // 分页加载更多时，顶部 spinner 用户在列表底部看不到，因此补一个靠近“显示更多”的加载提示。
        if (isPaginating && !isBackfilling) {
            ret.push(
                <li key="search-paginating">
                    <Spinner />
                </li>,
            );
        }

        if (canShowMore) {
            ret.push(
                <li key="search-more">
                    <AccessibleButton
                        kind="link_inline"
                        onClick={onSearchMore}
                        disabled={inProgress || isBackfilling || isPaginating}
                    >
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

    return (
        <ScrollPanel
            ref={onRef}
            className={"mx_RoomView_searchResultsPanel " + className}
            startAtBottom={false}
            stickyBottom={false}
            onFillRequest={onFillRequest}
        >
            <li className="mx_RoomView_scrollheader" />
            {ret}
        </ScrollPanel>
    );
};
