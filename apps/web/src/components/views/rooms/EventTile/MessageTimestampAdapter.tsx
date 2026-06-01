/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { MessageTimestampView } from "@element-hq/web-shared-components";

import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import { type MessageTimestampViewModelProps } from "../../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel.ts";
import { Icon as LateIcon } from "../../../../../res/img/sensor.svg";

/**
 * Props for the {@link MessageTimestampAdapter} component.
 */
interface MessageTimestampAdapterProps {
    /** View model backing the event tile timestamp. */
    eventTileViewModel: EventTileViewModel;
    /** Chooses the plain or linked timestamp view model. */
    kind: "plain" | "linked";
    /** Props forwarded into the timestamp view model. */
    timestampProps: MessageTimestampViewModelProps;
}

/**
 * Renders the timestamp badge for an event tile.
 */
export function MessageTimestampAdapter({
    eventTileViewModel,
    kind,
    timestampProps,
}: Readonly<MessageTimestampAdapterProps>): JSX.Element {
    const vm =
        kind === "linked"
            ? eventTileViewModel.getLinkedMessageTimestampViewModel(timestampProps)
            : eventTileViewModel.getMessageTimestampViewModel(timestampProps);

    useEffect(() => {
        vm.setProps(timestampProps);
    }, [vm, timestampProps]);

    return (
        <>
            {timestampProps.receivedTs ? (
                <LateIcon className="mx_MessageTimestamp_lateIcon" width="16" height="16" />
            ) : undefined}
            <MessageTimestampView vm={vm} className="mx_MessageTimestamp" />
        </>
    );
}
