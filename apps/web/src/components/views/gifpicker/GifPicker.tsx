/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type Dispatch, type JSX, useCallback, useContext, useEffect, useRef, useState } from "react";
import { type IContent, type IEventRelation, EventType, THREAD_RELATION_TYPE } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { InlineSpinner } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import { KlipyGifService, pickBestFormat, type KlipyGifResult } from "../../../gif/KlipyGifService";
import { uploadFile } from "../../../ContentMessages";
import dis from "../../../dispatcher/dispatcher";
import { attachRelation } from "../../../utils/messages";
import { addReplyToMessageContent } from "../../../utils/Reply";
import { GifSearch } from "./GifSearch";
import { GifGrid, GIFS_PER_ROW } from "./GifGrid";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext.tsx";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import {
    type IAction as RovingAction,
    type IState as RovingState,
    RovingTabIndexProvider,
    Type,
} from "../../../accessibility/RovingTabIndex";
import { Key } from "../../../Keyboard";

interface GifPickerProps {
    relation?: IEventRelation;
    onFinished: () => void;
}

/**
 * A Discord-style GIF search picker that shows trending GIFs by default and
 * allows searching via the Klipy API. Selecting a GIF downloads it and
 * uploads it to the homeserver as an m.sticker event.
 */
export function GifPicker({ relation, onFinished }: GifPickerProps): JSX.Element {
    const matrixClient = useContext(MatrixClientContext);
    const { room, replyToEvent, timelineRenderingType } = useScopedRoomContext(
        "room",
        "replyToEvent",
        "timelineRenderingType",
    );
    const roomId = room!.roomId;
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<KlipyGifResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nextCursor, setNextCursor] = useState<string | undefined>();

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const service = KlipyGifService.sharedInstance();

    // Fetch trending GIFs on mount
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        service
            .featured(20)
            .then((response) => {
                if (!cancelled) {
                    setResults(response.results);
                    setNextCursor(response.next);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    logger.error("Failed to fetch trending GIFs:", err);
                    setError(_t("composer|gif_error"));
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [service]);

    // Debounced search
    const handleQueryChange = useCallback(
        (newQuery: string): void => {
            setQuery(newQuery);

            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            if (abortRef.current) {
                abortRef.current.abort();
            }

            if (newQuery.trim() === "") {
                // Reset to trending
                setLoading(true);
                setError(null);
                service
                    .featured(20)
                    .then((response) => {
                        setResults(response.results);
                        setNextCursor(response.next);
                        setLoading(false);
                    })
                    .catch((err) => {
                        logger.error("Failed to fetch trending GIFs:", err);
                        setError(_t("composer|gif_error"));
                        setLoading(false);
                    });
                return;
            }

            debounceRef.current = setTimeout(() => {
                const controller = new AbortController();
                abortRef.current = controller;

                setLoading(true);
                setError(null);

                service
                    .search(newQuery.trim(), 20)
                    .then((response) => {
                        if (!controller.signal.aborted) {
                            setResults(response.results);
                            setNextCursor(response.next);
                            setLoading(false);
                        }
                    })
                    .catch((err) => {
                        if (!controller.signal.aborted) {
                            logger.error("Failed to search GIFs:", err);
                            setError(_t("composer|gif_error"));
                            setLoading(false);
                        }
                    });
            }, 300);
        },
        [service],
    );

    // Load more results for infinite scroll
    const handleLoadMore = useCallback((): void => {
        if (!nextCursor || loading) return;

        setLoading(true);

        const fetchFn =
            query.trim() === "" ? service.featured(20, nextCursor) : service.search(query.trim(), 20, nextCursor);

        fetchFn
            .then((response) => {
                setResults((prev) => [...prev, ...response.results]);
                setNextCursor(response.next);
                setLoading(false);
            })
            .catch((err) => {
                logger.error("Failed to load more GIFs:", err);
                setLoading(false);
            });
    }, [nextCursor, loading, query, service]);

    // Handle GIF selection: pick best format, fetch, upload to homeserver, and send as m.sticker
    const handleSelect = useCallback(
        async (gif: KlipyGifResult): Promise<void> => {
            onFinished();

            try {
                const bestFormats = pickBestFormat(gif);
                const fullFormat = bestFormats.full;

                // Fetch the GIF bytes from the Klipy CDN
                const response = await fetch(fullFormat.url);
                const blob = await response.blob();

                // Upload to the Matrix homeserver (handles E2EE automatically)
                const uploadResult = await uploadFile(matrixClient, roomId, blob);

                // Build m.sticker event content with custom GIF metadata
                const content: IContent = {
                    "body": gif.content_description || "GIF",
                    "url": uploadResult.url,
                    "io.element.gif": true,
                    "info": {
                        "w": fullFormat.width,
                        "h": fullFormat.height,
                        "mimetype": fullFormat.mimeType,
                        "size": fullFormat.size,
                        "io.element.animated": true,
                    },
                };

                // For E2EE rooms, uploadFile returns a `file` instead of `url`
                if (uploadResult.file) {
                    content.file = uploadResult.file;
                    content.url = uploadResult.file.url;
                }

                // Attach thread/reply relations
                attachRelation(content, relation);
                if (replyToEvent) {
                    addReplyToMessageContent(content, replyToEvent);
                }

                // Derive threadId from relation for the sendEvent call
                const threadId = relation?.rel_type === THREAD_RELATION_TYPE.name ? (relation.event_id ?? null) : null;

                // Content includes custom io.element.* fields beyond the base StickerEventContent type
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await matrixClient.sendEvent(roomId, threadId, EventType.Sticker, content as any);

                if (replyToEvent) {
                    // Clear reply_to_event as we put the message into the queue
                    // if the send fails, retry will handle resending.
                    dis.dispatch({
                        action: "reply_to_event",
                        event: null,
                        context: timelineRenderingType,
                    });
                }
            } catch (err) {
                logger.error("Failed to send GIF:", err);
            }
        },
        [roomId, matrixClient, relation, replyToEvent, onFinished, timelineRenderingType],
    );

    // Keyboard navigation for grid - handles arrow keys to move between GIF items
    const handleKeyDown = useCallback(
        (ev: React.KeyboardEvent, state: RovingState, dispatch: Dispatch<RovingAction>): void => {
            if (!state.activeNode) return;
            if (![Key.ARROW_DOWN, Key.ARROW_RIGHT, Key.ARROW_LEFT, Key.ARROW_UP].includes(ev.key)) return;

            // Get DOM structure: button -> gridcell -> row
            const gridcellNode = state.activeNode.parentElement;
            const rowElement = gridcellNode?.parentElement;
            if (!rowElement || !gridcellNode) return;

            const columnIndex = Array.from(rowElement.children).indexOf(gridcellNode);
            const refIndex = state.nodes.indexOf(state.activeNode);

            let focusNode: HTMLElement | undefined;
            let newRowElement: Element | undefined;

            switch (ev.key) {
                case Key.ARROW_LEFT:
                    focusNode = state.nodes[refIndex - 1];
                    newRowElement = focusNode?.parentElement?.parentElement ?? undefined;
                    break;

                case Key.ARROW_RIGHT:
                    focusNode = state.nodes[refIndex + 1];
                    newRowElement = focusNode?.parentElement?.parentElement ?? undefined;
                    break;

                case Key.ARROW_UP:
                case Key.ARROW_DOWN: {
                    // Calculate the offset to move to the same column in prev/next row
                    const offset =
                        ev.key === Key.ARROW_UP
                            ? -(columnIndex + 1 + (GIFS_PER_ROW - 1 - columnIndex))
                            : GIFS_PER_ROW - columnIndex;
                    const targetNode = state.nodes[refIndex + offset];
                    newRowElement = targetNode?.parentElement?.parentElement ?? undefined;
                    if (newRowElement) {
                        const newColumnIndex = Math.min(columnIndex, newRowElement.children.length - 1);
                        const targetCell = newRowElement.children[newColumnIndex];
                        focusNode = targetCell?.children[0] as HTMLElement | undefined;
                    }
                    break;
                }
            }

            if (focusNode) {
                focusNode.focus();
                dispatch({
                    type: Type.SetFocus,
                    payload: { node: focusNode },
                });

                if (rowElement !== newRowElement) {
                    focusNode.scrollIntoView({
                        behavior: "auto",
                        block: "nearest",
                    });
                }

                ev.preventDefault();
                ev.stopPropagation();
            }
        },
        [],
    );

    return (
        <RovingTabIndexProvider onKeyDown={handleKeyDown}>
            {({ onKeyDownHandler }) => (
                <div className="mx_GifPicker" onKeyDown={onKeyDownHandler}>
                    <GifSearch query={query} onChange={handleQueryChange} />
                    <div className="mx_GifPicker_header">
                        <span>{query.trim() === "" ? _t("composer|gif_trending") : query}</span>
                    </div>
                    <div className="mx_GifPicker_body">
                        {error ? (
                            <div className="mx_GifPicker_error">
                                <span>{error}</span>
                            </div>
                        ) : (
                            <GifGrid
                                results={results}
                                onSelect={handleSelect}
                                onLoadMore={handleLoadMore}
                                loading={loading}
                            />
                        )}
                        {loading && (
                            <div className="mx_GifPicker_loading">
                                <InlineSpinner />
                            </div>
                        )}
                    </div>
                    <div className="mx_GifPicker_footer">
                        <span>{_t("composer|gif_powered_by_klipy")}</span>
                    </div>
                </div>
            )}
        </RovingTabIndexProvider>
    );
}
