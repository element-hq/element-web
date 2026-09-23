/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, type Thread } from "matrix-js-sdk/src/matrix";

import { TimelineRenderingType } from "../../../../contexts/RoomContext";

/** Minimal room surface used to look up a thread for an event. */
export interface EventTileThreadLookup {
    /** Finds the thread associated with an event. */
    findThreadForEvent(mxEvent: MatrixEvent): Thread | null | undefined;
}

/** Search thread-info rendering kind. */
export type SearchThreadInfoKind = "none" | "text" | "link";

/** Search timeline thread-info display state. */
export interface EventTileSearchThreadInfo {
    /** Kind of search thread info to render. */
    kind: SearchThreadInfoKind;
    /** Link target when rendering linked thread info. */
    href?: string;
}

/** Inputs for deriving EventTile thread display state. */
export interface EventTileThreadStateInput {
    /** Matrix event rendered by the tile. */
    mxEvent: MatrixEvent;
    /** Thread associated with the event, when available. */
    thread: Thread | null;
    /** Current timeline rendering mode. */
    timelineRenderingType: TimelineRenderingType;
    /** Optional search-result link for thread info. */
    highlightLink?: string;
}

/** EventTile thread display state. */
export interface EventTileThreadState {
    /** Thread associated with the event, when available. */
    thread: Thread | null;
    /** Whether EventTile should render the main thread summary. */
    shouldShowThreadSummary: boolean;
    /** Whether EventTile should render the thread panel reply summary. */
    shouldShowThreadPanelSummary: boolean;
    /** Timestamp of the latest thread reply, when available. */
    threadReplyEventTs?: number;
    /** Search timeline thread-info display state. */
    searchThreadInfo: EventTileSearchThreadInfo;
}

/**
 * Finds the thread associated with an event.
 *
 * Accessing the thread through the room covers a race where the event has not
 * discovered its thread yet during sync.
 */
export function getEventTileThread(mxEvent: MatrixEvent, room?: EventTileThreadLookup | null): Thread | null {
    return mxEvent.getThread() ?? room?.findThreadForEvent(mxEvent) ?? null;
}

function getSearchThreadInfo(shouldShowSearchThreadInfo: boolean, highlightLink?: string): EventTileSearchThreadInfo {
    if (!shouldShowSearchThreadInfo) {
        return { kind: "none" };
    }

    if (highlightLink) {
        return { kind: "link", href: highlightLink };
    }

    return { kind: "text" };
}

/** Derives thread display state for EventTile. */
export function getEventTileThreadState({
    mxEvent,
    thread,
    timelineRenderingType,
    highlightLink,
}: EventTileThreadStateInput): EventTileThreadState {
    const shouldShowThreadSummary = !!thread && thread.id === mxEvent.getId();
    const shouldShowSearchThreadInfo =
        !shouldShowThreadSummary && timelineRenderingType === TimelineRenderingType.Search && !!mxEvent.threadRootId;
    const searchThreadInfo = getSearchThreadInfo(shouldShowSearchThreadInfo, highlightLink);

    return {
        thread,
        shouldShowThreadSummary,
        shouldShowThreadPanelSummary: !!thread,
        threadReplyEventTs: thread?.replyToEvent?.getTs(),
        searchThreadInfo,
    };
}
