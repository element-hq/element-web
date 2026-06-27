/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import { _t } from "../../../languageHandler";
import { type SearchResultPreview } from "../../../Searching";
import { formatFullDateNoTime } from "../../../DateUtils";
import BaseAvatar from "../avatars/BaseAvatar";
import AccessibleButton from "../elements/AccessibleButton";
import Spinner from "../elements/Spinner";

/** Distance (px) from the bottom of the list at which we start loading the next page (Telegram-style infinite scroll). */
const LOAD_MORE_THRESHOLD_PX = 80;

interface Props {
    /** Ordered (newest-first) result preview rows; parallel to the live-stepping match list. */
    previews: SearchResultPreview[];
    /** Whether the backend search is still settling (drives the loading spinner). */
    inProgress: boolean;
    /** The search error, if the request failed. */
    error?: Error;
    /** Whether more result pages remain; gates the infinite-scroll "load more". */
    hasMore: boolean;
    /** Jump the live timeline to result row `index` (reuses the {@link SearchMatch} stepping path). */
    onResultClick: (index: number) => void;
    /** Load the next page of results; called when the list is scrolled near the bottom. */
    onLoadMore: () => void;
    /** Resolve a sender's display name for a row (RoomView resolves it against the matched room's members). */
    getSenderName: (preview: SearchResultPreview) => string;
}

/**
 * Telegram-style dropdown list of in-room search results, rendered below the search bar over the live timeline
 *. Each row shows the sender (avatar + name), the matched message preview and its date; clicking a
 * row jumps the live timeline to that message via the existing match-stepping path.
 */
const RoomSearchResults: React.FC<Props> = ({
    previews,
    inProgress,
    error,
    hasMore,
    onResultClick,
    onLoadMore,
    getSenderName,
}) => {
    // Telegram-style infinite scroll: ask the parent to load the next page as the user nears the bottom. Gated on
    // hasMore (no more pages → nothing to do) and !inProgress (a page is already loading → avoid a duplicate fetch).
    const onScroll = (e: React.UIEvent<HTMLDivElement>): void => {
        if (!hasMore || inProgress) return;
        const el = e.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_MORE_THRESHOLD_PX) {
            onLoadMore();
        }
    };

    let body: JSX.Element;
    if (error) {
        body = (
            <div className="mx_RoomSearchResults_status" role="status">
                {error.message}
            </div>
        );
    } else if (previews.length === 0) {
        body = inProgress ? (
            <div className="mx_RoomSearchResults_status">
                <Spinner />
            </div>
        ) : (
            <div className="mx_RoomSearchResults_status" role="status">
                {_t("room|search|no_results")}
            </div>
        );
    } else {
        body = (
            <div className="mx_RoomSearchResults_list" role="listbox" aria-label={_t("room|search|results_label")}>
                {previews.map((preview, index) => {
                    const senderName = getSenderName(preview);
                    return (
                        <AccessibleButton
                            key={preview.eventId}
                            className="mx_RoomSearchResults_row"
                            role="option"
                            aria-selected={false}
                            onClick={() => onResultClick(index)}
                        >
                            <BaseAvatar name={senderName} idName={preview.sender} size="32px" />
                            <div className="mx_RoomSearchResults_row_text">
                                <span className="mx_RoomSearchResults_row_sender">{senderName}</span>
                                <span className="mx_RoomSearchResults_row_body">{preview.body}</span>
                            </div>
                            <time className="mx_RoomSearchResults_row_date">
                                {formatFullDateNoTime(new Date(preview.ts))}
                            </time>
                        </AccessibleButton>
                    );
                })}
                {/* Spinner appended below the loaded rows while the next page is paginating in. */}
                {inProgress && (
                    <div className="mx_RoomSearchResults_loadingMore" role="status">
                        <Spinner />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="mx_RoomSearchResults" onScroll={onScroll}>
            {body}
        </div>
    );
};

export default RoomSearchResults;
