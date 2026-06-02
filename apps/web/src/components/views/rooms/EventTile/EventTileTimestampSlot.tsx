/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import { type MessageTimestampViewModelProps } from "../../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel";
import { MessageTimestampAdapter } from "./MessageTimestampAdapter";

interface EventTileTimestampSlotProps {
    eventTileViewModel: EventTileViewModel;
    kind: "plain" | "linked";
    timestampProps: MessageTimestampViewModelProps;
    showTimestamp: boolean;
    showDummy: boolean;
}

/** Renders a real or placeholder timestamp slot for an EventTile. */
export function EventTileTimestampSlot({
    eventTileViewModel,
    kind,
    timestampProps,
    showTimestamp,
    showDummy,
}: Readonly<EventTileTimestampSlotProps>): JSX.Element | null {
    if (showTimestamp) {
        return (
            <MessageTimestampAdapter
                eventTileViewModel={eventTileViewModel}
                kind={kind}
                timestampProps={timestampProps}
            />
        );
    }

    if (showDummy) {
        return <span className="mx_MessageTimestamp" />;
    }

    return null;
}
