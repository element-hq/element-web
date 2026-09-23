/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { type Thread } from "matrix-js-sdk/src/matrix";
import { ThreadMessagePreviewView } from "@element-hq/web-shared-components";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useScopedRoomContext } from "../../../../contexts/ScopedRoomContext.tsx";
import { useSettingValue } from "../../../../hooks/useSettings";
import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";

/**
 * Props for the {@link ThreadMessagePreviewAdapter} component.
 */
interface ThreadMessagePreviewAdapterProps {
    /** View model backing the thread preview. */
    eventTileViewModel: EventTileViewModel;
    /** Thread whose message preview is rendered. */
    thread: Thread;
    /** Whether the sender display name should be shown. */
    showDisplayName?: boolean;
}

/**
 * Renders the preview shown for a thread message.
 */
export function ThreadMessagePreviewAdapter({
    eventTileViewModel,
    thread,
    showDisplayName = false,
}: Readonly<ThreadMessagePreviewAdapterProps>): JSX.Element {
    const cli = useMatrixClientContext();
    const { room, timelineRenderingType, lowBandwidth } = useScopedRoomContext(
        "room",
        "timelineRenderingType",
        "lowBandwidth",
    );
    const useOnlyCurrentProfiles = useSettingValue("useOnlyCurrentProfiles");
    const vm = eventTileViewModel.getThreadMessagePreviewViewModel({
        cli,
        thread,
        room,
        timelineRenderingType,
        lowBandwidth,
        useOnlyCurrentProfiles,
        showDisplayName,
        avatarClassName: "mx_BaseAvatar",
    });

    useEffect(() => {
        // This child VM owns Matrix listeners, so release it when the view using it leaves the tree.
        return () => eventTileViewModel.releaseThreadMessagePreviewViewModel();
    }, [eventTileViewModel]);

    useEffect(() => {
        vm.setClient(cli);
        vm.setThread(thread);
        vm.setRoom(room);
        vm.setTimelineRenderingType(timelineRenderingType);
        vm.setLowBandwidth(lowBandwidth);
        vm.setUseOnlyCurrentProfiles(useOnlyCurrentProfiles);
        vm.setShowDisplayName(showDisplayName);
    }, [vm, cli, thread, room, timelineRenderingType, lowBandwidth, useOnlyCurrentProfiles, showDisplayName]);

    return <ThreadMessagePreviewView vm={vm} />;
}
