/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode, useEffect, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type Room } from "matrix-js-sdk/src/matrix";

import EventIndexPeg from "../../../indexing/EventIndexPeg";
import type EventIndex from "../../../indexing/EventIndex";
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
}

/**
 * Track whether the given event index is still crawling not-yet-indexed history.
 *
 * The index reports its progress via `currentRoom()`, which returns the room currently being
 * crawled, or `null` once every checkpoint has drained and the index is fully built. It emits a
 * `changedCheckpoint` event whenever that progresses, so we subscribe to it and re-evaluate, which
 * means the warning auto-clears the moment indexing finishes.
 *
 * @param index The event index to observe, or `null` if there is no index.
 * @returns `true` while the crawl is still in progress, `false` otherwise.
 */
function useIsCrawlInProgress(index: EventIndex | null): boolean {
    const [crawlInProgress, setCrawlInProgress] = useState<boolean>(() =>
        index ? index.currentRoom() !== null : false,
    );

    useEffect(() => {
        if (!index) {
            setCrawlInProgress(false);
            return;
        }

        const onChangedCheckpoint = (currentRoom: Room | null): void => {
            setCrawlInProgress(currentRoom !== null);
        };

        // Re-sync in case the crawl state changed between the initial render and the subscription.
        setCrawlInProgress(index.currentRoom() !== null);
        index.on("changedCheckpoint", onChangedCheckpoint);

        return () => {
            index.removeListener("changedCheckpoint", onChangedCheckpoint);
        };
    }, [index]);

    return crawlInProgress;
}

export default function SearchWarning({ isRoomEncrypted, kind, showLogo = true }: IProps): JSX.Element {
    const eventIndex = EventIndexPeg.get();
    const crawlInProgress = useIsCrawlInProgress(eventIndex);

    if (!isRoomEncrypted) return <></>;

    if (eventIndex) {
        // The index exists but is still draining its checkpoint queue, so searches over
        // not-yet-indexed history may silently return partial results (#32253). Warn the user.
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
