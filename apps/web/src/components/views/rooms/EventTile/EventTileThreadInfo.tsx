/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { ThreadsIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../languageHandler";
import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import { type EventTileThreadState } from "../../../../viewmodels/room/timeline/event-tile/EventTileThreadState";
import { ThreadMessagePreviewAdapter } from "./ThreadMessagePreviewAdapter";
import { ThreadSummaryAdapter } from "./ThreadSummaryAdapter";

interface EventTileThreadInfoProps {
    eventTileViewModel: EventTileViewModel;
    mxEvent: MatrixEvent;
    threadState: EventTileThreadState;
}

/** Renders the thread-panel reply summary shown under a preview tile. */
export function EventTileThreadPanelSummary({
    eventTileViewModel,
    threadState,
}: Readonly<Omit<EventTileThreadInfoProps, "mxEvent">>): JSX.Element | null {
    if (!threadState.shouldShowThreadPanelSummary || !threadState.thread) {
        return null;
    }

    return (
        <div className="mx_ThreadPanel_replies">
            <ThreadsIcon />
            <span className="mx_ThreadPanel_replies_amount">{threadState.thread.length}</span>
            <ThreadMessagePreviewAdapter eventTileViewModel={eventTileViewModel} thread={threadState.thread} />
        </div>
    );
}

/** Renders thread summary or search thread affordances for an EventTile. */
export function EventTileThreadInfo({
    eventTileViewModel,
    mxEvent,
    threadState,
}: Readonly<EventTileThreadInfoProps>): ReactNode {
    if (threadState.shouldShowThreadSummary && threadState.thread) {
        return (
            <ThreadSummaryAdapter
                eventTileViewModel={eventTileViewModel}
                mxEvent={mxEvent}
                thread={threadState.thread}
                data-testid="thread-summary"
            />
        );
    }

    if (threadState.searchThreadInfo.kind === "link") {
        return (
            <a className="mx_ThreadSummary_icon" href={threadState.searchThreadInfo.href}>
                <ThreadsIcon />
                {_t("timeline|thread_info_basic")}
            </a>
        );
    }

    if (threadState.searchThreadInfo.kind === "text") {
        return (
            <p className="mx_ThreadSummary_icon">
                <ThreadsIcon />
                {_t("timeline|thread_info_basic")}
            </p>
        );
    }

    return null;
}
