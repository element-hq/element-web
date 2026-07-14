/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode, useCallback, useEffect, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import EventIndexPeg from "../../../indexing/EventIndexPeg";
import type EventIndex from "../../../indexing/EventIndex";
import { SearchScope } from "../../../Searching";
import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserTab";
import AccessibleButton, { type ButtonEvent } from "./AccessibleButton";

export enum WarningKind {
    Files,
    Search,
}

interface IProps {
    isRoomEncrypted?: boolean;
    kind: WarningKind;
    showLogo?: boolean;
    /** The scope of the search being warned about; only meaningful for {@link WarningKind.Search}. */
    scope?: SearchScope;
    /** The room being searched. Mirrors `SearchInfo.roomId`: `undefined` when searching all rooms. */
    roomId?: string;
}

/**
 * Track whether the index still has history left to crawl that is relevant to the given search.
 *
 * Seshat has no notion of a room being *fully* indexed: {@link EventIndex.isRoomIndexed} only
 * reports whether the index holds any events for a room, not whether it holds all of them. The
 * closest available signal is whether the crawler still holds an outstanding checkpoint for the
 * room, exposed via {@link EventIndex.crawlingRooms}. A room-scoped search therefore asks about
 * that room alone, while an all-rooms search is affected by any outstanding checkpoint.
 *
 * Note that the absence of a checkpoint is not proof of completeness: a room also has no
 * checkpoint if it never had a back-pagination token to crawl from, if its checkpoint was dropped
 * because the server rejected the request, or before the initial checkpoints have been seeded. So
 * this signal under-warns rather than over-warns.
 *
 * The index emits `changedCheckpoint` on each checkpoint transition, but the payload carries only
 * the globally-current room, so we re-read the checkpoint set on each event rather than trust it.
 *
 * @param index The event index to observe, or `null` if there is no index.
 * @param scope The scope of the search, if this warning is being rendered for one.
 * @param roomId The room being searched, or `undefined` when searching all rooms.
 * @returns `true` while history relevant to the search is still being crawled, `false` otherwise.
 */
function useIsCrawlInProgress(index: EventIndex | null, scope?: SearchScope, roomId?: string): boolean {
    const readCrawlInProgress = useCallback((): boolean => {
        if (!index) return false;
        const { crawlingRooms } = index.crawlingRooms();
        // Fall back to the global check when we don't know which room is being searched: the room
        // id may still be undefined while a room alias is being resolved.
        if (scope !== SearchScope.Room || roomId === undefined) return crawlingRooms.size > 0;
        return crawlingRooms.has(roomId);
    }, [index, scope, roomId]);

    const [crawlInProgress, setCrawlInProgress] = useState<boolean>(readCrawlInProgress);

    useEffect(() => {
        if (!index) {
            setCrawlInProgress(false);
            return;
        }

        const onChangedCheckpoint = (): void => {
            setCrawlInProgress(readCrawlInProgress());
        };

        // Re-sync in case the crawl state changed between the initial render and the subscription.
        onChangedCheckpoint();
        index.on("changedCheckpoint", onChangedCheckpoint);

        return () => {
            index.removeListener("changedCheckpoint", onChangedCheckpoint);
        };
    }, [index, readCrawlInProgress]);

    return crawlInProgress;
}

export default function SearchWarning({ isRoomEncrypted, kind, showLogo = true, scope, roomId }: IProps): JSX.Element {
    const eventIndex = EventIndexPeg.get();
    const crawlInProgress = useIsCrawlInProgress(eventIndex, scope, roomId);

    if (!isRoomEncrypted) return <></>;

    if (eventIndex) {
        // The index exists but still has history to crawl for this search, so it may silently
        // return partial results (#32253). Warn the user.
        if (crawlInProgress && kind === WarningKind.Search) {
            // This warning appears dynamically while a search panel is already open (the crawler
            // finishes draining mid-session), so mark it as a polite live region for screen readers.
            return (
                <div className="mx_SearchWarning" role="status">
                    <span>{_t("seshat|warning_kind_search_partial")}</span>
                </div>
            );
        }
        return <></>;
    }

    if (EventIndexPeg.error) {
        return (
            <div className="mx_SearchWarning">
                {_t(
                    "seshat|error_initialising",
                    {},
                    {
                        a: (sub) => (
                            <AccessibleButton
                                kind="link_inline"
                                onClick={(evt: ButtonEvent) => {
                                    evt.preventDefault();
                                    dis.dispatch({
                                        action: Action.ViewUserSettings,
                                        initialTabId: UserTab.Security,
                                    });
                                }}
                            >
                                {sub}
                            </AccessibleButton>
                        ),
                    },
                )}
            </div>
        );
    }

    const brand = SdkConfig.get("brand");
    const desktopBuilds = SdkConfig.getObject("desktop_builds");

    let text: ReactNode | undefined;
    let logo: JSX.Element | undefined;
    if (desktopBuilds?.get("available")) {
        logo = <img alt="" src={desktopBuilds.get("logo")} width="32px" />;
        const buildUrl = desktopBuilds.get("url");
        switch (kind) {
            case WarningKind.Files:
                text = _t(
                    "seshat|warning_kind_files_app",
                    {},
                    {
                        a: (sub) => (
                            <a href={buildUrl} target="_blank" rel="noreferrer noopener">
                                {sub}
                            </a>
                        ),
                    },
                );
                break;
            case WarningKind.Search:
                text = _t(
                    "seshat|warning_kind_search_app",
                    {},
                    {
                        a: (sub) => (
                            <a href={buildUrl} target="_blank" rel="noreferrer noopener">
                                {sub}
                            </a>
                        ),
                    },
                );
                break;
        }
    } else {
        switch (kind) {
            case WarningKind.Files:
                text = _t("seshat|warning_kind_files", { brand });
                break;
            case WarningKind.Search:
                text = _t("seshat|warning_kind_search", { brand });
                break;
        }
    }

    // for safety
    if (!text) {
        logger.warn("Unknown desktop builds warning kind: ", kind);
        return <></>;
    }

    return (
        <div className="mx_SearchWarning">
            {showLogo ? logo : null}
            <span>{text}</span>
        </div>
    );
}
