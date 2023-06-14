/*
Copyright 2015 - 2023 The Matrix.org Foundation C.I.C.

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

import React, { forwardRef, RefObject, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ISearchResults } from "matrix-js-sdk/src/@types/search";
import { IThreadBundledRelationship } from "matrix-js-sdk/src/models/event";
import { THREAD_RELATION_TYPE } from "matrix-js-sdk/src/models/thread";
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import ScrollPanel from "./ScrollPanel";
import { SearchScope } from "../views/rooms/SearchBar";
import Spinner from "../views/elements/Spinner";
import { _t } from "../../languageHandler";
import { haveRendererForEvent } from "../../events/EventTileFactory";
import SearchResultTile from "../views/rooms/SearchResultTile";
import { searchPagination } from "../../Searching";
import Modal from "../../Modal";
import ErrorDialog from "../views/dialogs/ErrorDialog";
import ResizeNotifier from "../../utils/ResizeNotifier";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import RoomContext from "../../contexts/RoomContext";

const DEBUG = false;
let debuglog = function (msg: string): void {};

/* istanbul ignore next */
if (DEBUG) {
    // using bind means that we get to keep useful line numbers in the console
    debuglog = logger.log.bind(console);
}

interface Props {
    term: string;
    scope: SearchScope;
    promise: Promise<ISearchResults>;
    abortController?: AbortController;
    resizeNotifier: ResizeNotifier;
    className: string;
    onUpdate(inProgress: boolean, results: ISearchResults | null): void;
}

// XXX: todo: merge overlapping results somehow?
// XXX: why doesn't searching on name work?
export const RoomSearchView = forwardRef<ScrollPanel, Props>(
    (
        { term, scope, promise, abortController, resizeNotifier, className, onUpdate }: Props,
        ref: RefObject<ScrollPanel>,
    ) => {
        const client = useContext(MatrixClientContext);
        const roomContext = useContext(RoomContext);
        const [inProgress, setInProgress] = useState(true);
        const [highlights, setHighlights] = useState<string[] | null>(null);
        const [results, setResults] = useState<ISearchResults | null>(null);
        const aborted = useRef(false);
        // A map from room ID to permalink creator
        const permalinkCreators = useRef(new Map<string, RoomPermalinkCreator>()).current;

        useEffect(() => {
            return () => {
                permalinkCreators.forEach((pc) => pc.stop());
                permalinkCreators.clear();
            };
        }, [permalinkCreators]);

        const handleSearchResult = useCallback(
            (searchPromise: Promise<ISearchResults>): Promise<boolean> => {
                setInProgress(true);

                return searchPromise
                    .then(
                        async (results): Promise<boolean> => {
                            debuglog("search complete");
                            if (aborted.current) {
                                logger.error("Discarding stale search results");
                                return false;
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
                                    const bundledRelationship =
                                        event.getServerAggregatedRelation<IThreadBundledRelationship>(
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
                            setResults({ ...results }); // copy to force a refresh
                            return false;
                        },
                        (error) => {
                            if (aborted.current) {
                                logger.error("Discarding stale search results");
                                return false;
                            }
                            logger.error("Search failed", error);
                            Modal.createDialog(ErrorDialog, {
                                title: _t("Search failed"),
                                description:
                                    error?.message ??
                                    _t("Server may be unavailable, overloaded, or search timed out :("),
                            });
                            return false;
                        },
                    )
                    .finally(() => {
                        setInProgress(false);
                    });
            },
            [client, term],
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

        // show searching spinner
        if (results?.count === undefined) {
            return (
                <div
                    className="mx_RoomView_messagePanel mx_RoomView_messagePanelSearchSpinner"
                    data-testid="messagePanelSearchSpinner"
                />
            );
        }

        const onSearchResultsFillRequest = async (backwards: boolean): Promise<boolean> => {
            if (!backwards) {
                return false;
            }

            if (!results.next_batch) {
                debuglog("no more search results");
                return false;
            }

            debuglog("requesting more search results");
            const searchPromise = searchPagination(client, results);
            return handleSearchResult(searchPromise);
        };

        const ret: JSX.Element[] = [];

        if (inProgress) {
            ret.push(
                <li key="search-spinner">
                    <Spinner />
                </li>,
            );
        }

        if (!results.next_batch) {
            if (!results?.results?.length) {
                ret.push(
                    <li key="search-top-marker">
                        <h2 className="mx_RoomView_topMarker">{_t("No results")}</h2>
                    </li>,
                );
            } else {
                ret.push(
                    <li key="search-top-marker">
                        <h2 className="mx_RoomView_topMarker">{_t("No more results")}</h2>
                    </li>,
                );
            }
        }

        // once dynamic content in the search results load, make the scrollPanel check
        // the scroll offsets.
        const onHeightChanged = (): void => {
            const scrollPanel = ref.current;
            scrollPanel?.checkScroll();
        };

        let lastRoomId: string | undefined;
        let mergedTimeline: MatrixEvent[] = [];
        let ourEventsIndexes: number[] = [];

        for (let i = (results?.results?.length || 0) - 1; i >= 0; i--) {
            const result = results.results[i];

            const mxEv = result.context.getEvent();
            const roomId = mxEv.getRoomId()!;
            const room = client.getRoom(roomId);
            if (!room) {
                // if we do not have the room in js-sdk stores then hide it as we cannot easily show it
                // As per the spec, an all rooms search can create this condition,
                // it happens with Seshat but not Synapse.
                // It will make the result count not match the displayed count.
                logger.log("Hiding search result from an unknown room", roomId);
                continue;
            }

            if (!haveRendererForEvent(mxEv, roomContext.showHiddenEvents)) {
                // XXX: can this ever happen? It will make the result count
                // not match the displayed count.
                continue;
            }

            if (scope === SearchScope.All) {
                if (roomId !== lastRoomId) {
                    ret.push(
                        <li key={mxEv.getId() + "-room"}>
                            <h2>
                                {_t("Room")}: {room.name}
                            </h2>
                        </li>,
                    );
                    lastRoomId = roomId;
                }
            }

            const resultLink = "#/room/" + roomId + "/" + mxEv.getId();

            // merging two successive search result if the query is present in both of them
            const currentTimeline = result.context.getTimeline();
            const nextTimeline = i > 0 ? results.results[i - 1].context.getTimeline() : [];

            if (i > 0 && currentTimeline[currentTimeline.length - 1].getId() == nextTimeline[0].getId()) {
                // if this is the first searchResult we merge then add all values of the current searchResult
                if (mergedTimeline.length == 0) {
                    for (let j = mergedTimeline.length == 0 ? 0 : 1; j < result.context.getTimeline().length; j++) {
                        mergedTimeline.push(currentTimeline[j]);
                    }
                    ourEventsIndexes.push(result.context.getOurEventIndex());
                }

                // merge the events of the next searchResult
                for (let j = 1; j < nextTimeline.length; j++) {
                    mergedTimeline.push(nextTimeline[j]);
                }

                // add the index of the matching event of the next searchResult
                ourEventsIndexes.push(
                    ourEventsIndexes[ourEventsIndexes.length - 1] +
                        results.results[i - 1].context.getOurEventIndex() +
                        1,
                );

                continue;
            }

            if (mergedTimeline.length == 0) {
                mergedTimeline = result.context.getTimeline();
                ourEventsIndexes = [];
                ourEventsIndexes.push(result.context.getOurEventIndex());
            }

            let permalinkCreator = permalinkCreators.get(roomId);
            if (!permalinkCreator) {
                permalinkCreator = new RoomPermalinkCreator(room);
                permalinkCreator.start();
                permalinkCreators.set(roomId, permalinkCreator);
            }

            ret.push(
                <SearchResultTile
                    key={mxEv.getId()}
                    timeline={mergedTimeline}
                    ourEventsIndexes={ourEventsIndexes}
                    searchHighlights={highlights ?? []}
                    resultLink={resultLink}
                    permalinkCreator={permalinkCreator}
                    onHeightChanged={onHeightChanged}
                />,
            );

            ourEventsIndexes = [];
            mergedTimeline = [];
        }

        return (
            <ScrollPanel
                ref={ref}
                className={"mx_RoomView_searchResultsPanel " + className}
                onFillRequest={onSearchResultsFillRequest}
                resizeNotifier={resizeNotifier}
            >
                <li className="mx_RoomView_scrollheader" />
                {ret}
            </ScrollPanel>
        );
    },
);
