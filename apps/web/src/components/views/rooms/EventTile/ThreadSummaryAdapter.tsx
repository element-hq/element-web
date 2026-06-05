/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useEffect, type JSX } from "react";
import classNames from "classnames";
import { ThreadSummaryView } from "@element-hq/web-shared-components";

import { CardContext } from "../../right_panel/context";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useScopedRoomContext } from "../../../../contexts/ScopedRoomContext.tsx";
import { useSettingValue } from "../../../../hooks/useSettings";
import { type ThreadSummaryViewModel } from "../../../../viewmodels/room/timeline/event-tile/ThreadSummaryViewModel.tsx";

/**
 * Props for the {@link ThreadSummaryAdapter} component.
 */
interface ThreadSummaryAdapterProps extends Omit<React.ComponentPropsWithoutRef<"button">, "aria-label" | "onClick"> {
    /** View model owned by the parent event tile container. */
    vm: ThreadSummaryViewModel;
}

/**
 * Renders the thread summary tile for an event.
 */
export function ThreadSummaryAdapter({ vm, className, ...props }: Readonly<ThreadSummaryAdapterProps>): JSX.Element {
    const cli = useMatrixClientContext();
    const { isCard } = useContext(CardContext);
    const { narrow, room, timelineRenderingType, lowBandwidth } = useScopedRoomContext(
        "narrow",
        "room",
        "timelineRenderingType",
        "lowBandwidth",
    );
    const useOnlyCurrentProfiles = useSettingValue("useOnlyCurrentProfiles");

    useEffect(() => {
        vm.setClient(cli);
        vm.setNarrow(narrow);
        vm.setIsCard(isCard);
        vm.setRoom(room);
        vm.setTimelineRenderingType(timelineRenderingType);
        vm.setLowBandwidth(lowBandwidth);
        vm.setUseOnlyCurrentProfiles(useOnlyCurrentProfiles);
    }, [vm, cli, narrow, isCard, room, timelineRenderingType, lowBandwidth, useOnlyCurrentProfiles]);

    return <ThreadSummaryView {...props} vm={vm} className={classNames("mx_ThreadSummary", className)} />;
}
