/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useEffect, type JSX } from "react";
import classNames from "classnames";
import { type MatrixEvent, type Thread } from "matrix-js-sdk/src/matrix";
import { ThreadSummaryView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { CardContext } from "../../right_panel/context";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useScopedRoomContext } from "../../../../contexts/ScopedRoomContext.tsx";
import { useSettingValue } from "../../../../hooks/useSettings";
import { ThreadSummaryViewModel } from "../../../../viewmodels/room/timeline/event-tile/ThreadSummaryViewModel.tsx";

interface ThreadSummaryAdapterProps extends Omit<React.ComponentPropsWithoutRef<"button">, "aria-label" | "onClick"> {
    mxEvent: MatrixEvent;
    thread: Thread;
}

export function ThreadSummaryAdapter({
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
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ThreadSummaryViewModel({
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
            }),
    );

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
