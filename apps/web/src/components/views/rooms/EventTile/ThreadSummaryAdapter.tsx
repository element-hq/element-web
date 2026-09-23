/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useEffect, type JSX } from "react";
import classNames from "classnames";
import { type MatrixEvent, type Thread } from "matrix-js-sdk/src/matrix";
import { ThreadSummaryView } from "@element-hq/web-shared-components";

import { CardContext } from "../../right_panel/context";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useScopedRoomContext } from "../../../../contexts/ScopedRoomContext.tsx";
import { useSettingValue } from "../../../../hooks/useSettings";
import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";

/**
 * Props for the {@link ThreadSummaryAdapter} component.
 */
interface ThreadSummaryAdapterProps extends Omit<React.ComponentPropsWithoutRef<"button">, "aria-label" | "onClick"> {
    /** View model backing the thread summary tile. */
    eventTileViewModel: EventTileViewModel;
    /** Root event for the thread summary. */
    mxEvent: MatrixEvent;
    /** Thread represented by the summary tile. */
    thread: Thread;
}

/**
 * Renders the thread summary tile for an event.
 */
export function ThreadSummaryAdapter({
    eventTileViewModel,
    mxEvent,
    thread,
    className,
    ...props
}: Readonly<ThreadSummaryAdapterProps>): JSX.Element {
    const cli = useMatrixClientContext();
    const { isCard } = useContext(CardContext);
    const { narrow, room, timelineRenderingType, lowBandwidth } = useScopedRoomContext(
        "narrow",
        "room",
        "timelineRenderingType",
        "lowBandwidth",
    );
    const useOnlyCurrentProfiles = useSettingValue("useOnlyCurrentProfiles");
    const vm = eventTileViewModel.getThreadSummaryViewModel({
        cli,
        mxEvent,
        thread,
        narrow,
        isCard,
        room,
        timelineRenderingType,
        lowBandwidth,
        useOnlyCurrentProfiles,
        avatarClassName: "mx_BaseAvatar",
    });

    useEffect(() => {
        // This child VM owns Matrix listeners, so release it when the view using it leaves the tree.
        return () => eventTileViewModel.releaseThreadSummaryViewModel();
    }, [eventTileViewModel]);

    useEffect(() => {
        vm.setClient(cli);
        vm.setRootEvent(mxEvent);
        vm.setThread(thread);
        vm.setNarrow(narrow);
        vm.setIsCard(isCard);
        vm.setRoom(room);
        vm.setTimelineRenderingType(timelineRenderingType);
        vm.setLowBandwidth(lowBandwidth);
        vm.setUseOnlyCurrentProfiles(useOnlyCurrentProfiles);
    }, [vm, cli, mxEvent, thread, narrow, isCard, room, timelineRenderingType, lowBandwidth, useOnlyCurrentProfiles]);

    return <ThreadSummaryView {...props} vm={vm} className={classNames("mx_ThreadSummary", className)} />;
}
