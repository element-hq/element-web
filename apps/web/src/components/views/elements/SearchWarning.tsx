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
 * Track whether the index is still missing history that is relevant to the given search.
 *
 * A room-scoped search is incomplete if the crawler still holds a checkpoint for the room
 * ({@link EventIndex.crawlingRooms}, which covers both the checkpoint being crawled right now and
 * those still queued behind it), or if the index holds no events for it at all
 * ({@link EventIndex.isRoomIndexed}) — which is how a room looks before its checkpoint has been
 * seeded, and is the case the checkpoint set alone cannot see.
 *
 * The second question is only asked while the crawler still has work outstanding, for two reasons.
 * It is what the warning claims ("your search index is still being built"), and the index has no
 * event for its contents changing — `changedCheckpoint` fires only on checkpoint transitions, and
 * an idle crawler is silent — so a warning raised once the crawler has drained would never be
 * re-evaluated and would stick.
 *
 * Neither signal proves completeness: `isRoomIndexed` reports only that the index holds *some*
 * events for a room, not all of them, and a room has no checkpoint if it never had a
 * back-pagination token to crawl from or if its checkpoint was dropped because the server rejected
 * the request. So this under-warns rather than over-warns.
 *
 * An all-rooms search cannot ask the per-room question, so it uses the checkpoint set alone.
 *
 * The `changedCheckpoint` payload carries only the globally-current room and so cannot answer a
 * per-room question: we re-read the index on each event rather than trust it.
 *
 * @param index The event index to observe, or `null` if there is no index.
 * @param scope The scope of the search, if this warning is being rendered for one.
 * @param roomId The room being searched, or `undefined` when searching all rooms.
 * @returns `true` while the index is known to be missing history for the search, `false` otherwise.
 */
function useIsIndexIncomplete(index: EventIndex | null, scope?: SearchScope, roomId?: string): boolean {
    const readCheckpoints = useCallback((): { relevant: boolean; anyOutstanding: boolean } => {
        if (!index) return { relevant: false, anyOutstanding: false };
        const { crawlingRooms } = index.crawlingRooms();
        // Fall back to the global check when we don't know which room is being searched: the room
        // id may still be undefined while a room alias is being resolved.
        const roomScoped = scope === SearchScope.Room && roomId !== undefined;
        return {
            relevant: roomScoped ? crawlingRooms.has(roomId) : crawlingRooms.size > 0,
            anyOutstanding: crawlingRooms.size > 0,
        };
    }, [index, scope, roomId]);

    // The checkpoint half of the answer is known synchronously, so seed from it rather than
    // rendering an unwarned search for a room we already know is being crawled.
    const [incomplete, setIncomplete] = useState<boolean>(() => readCheckpoints().relevant);

    useEffect(() => {
        if (!index) {
            setIncomplete(false);
            return;
        }

        // Guards against a slow isRoomIndexed() response overwriting a newer one, or landing after
        // the scope changed or the component unmounted.
        let generation = 0;

        // Answer this scope and room from the checkpoint set up front, so that the previous
        // search's result is not left on screen while the first lookup below is in flight. Doing
        // this per effect run rather than per event matters: a checkpoint change is not a new
        // question, and resetting on one would blink an already-earned warning off and on again.
        setIncomplete(readCheckpoints().relevant);

        const update = async (): Promise<void> => {
            const current = ++generation;
            const { relevant, anyOutstanding } = readCheckpoints();

            if (relevant) {
                setIncomplete(true);
                return;
            }
            if (!anyOutstanding || scope !== SearchScope.Room || roomId === undefined) {
                setIncomplete(false);
                return;
            }

            // Nothing is queued for this room yet, but the index may hold nothing for it at all.
            // `undefined` means there is no index manager to ask, which is not evidence either way.
            const indexed = await index.isRoomIndexed(roomId);
            if (current === generation) setIncomplete(indexed === false);
        };

        const onChangedCheckpoint = (): void => {
            void update();
        };

        // Re-sync in case the crawl state changed between the initial render and the subscription.
        onChangedCheckpoint();
        index.on("changedCheckpoint", onChangedCheckpoint);

        return () => {
            generation++;
            index.removeListener("changedCheckpoint", onChangedCheckpoint);
        };
    }, [index, scope, roomId, readCheckpoints]);

    return incomplete;
}

export default function SearchWarning({ isRoomEncrypted, kind, showLogo = true, scope, roomId }: IProps): JSX.Element {
    const eventIndex = EventIndexPeg.get();
    const indexIncomplete = useIsIndexIncomplete(eventIndex, scope, roomId);

    if (!isRoomEncrypted) return <></>;

    if (eventIndex) {
        // The index is still missing history for this search, so it may silently return partial
        // results (#32253). Warn the user.
        if (indexIncomplete && kind === WarningKind.Search) {
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
