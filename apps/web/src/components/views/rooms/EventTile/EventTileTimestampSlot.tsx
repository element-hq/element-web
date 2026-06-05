/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { type MessageTimestampViewModel } from "../../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel";
import { MessageTimestampAdapter } from "./MessageTimestampAdapter";

interface EventTileTimestampSlotProps {
    vm: MessageTimestampViewModel;
    showLateIcon: boolean;
    showTimestamp: boolean;
    showDummy: boolean;
}

/** Renders a real or placeholder timestamp slot for an EventTile. */
export function EventTileTimestampSlot({
    vm,
    showLateIcon,
    showTimestamp,
    showDummy,
}: Readonly<EventTileTimestampSlotProps>): JSX.Element | null {
    if (showTimestamp) {
        return <MessageTimestampAdapter vm={vm} showLateIcon={showLateIcon} />;
    }

    if (showDummy) {
        return <span className="mx_MessageTimestamp" />;
    }

    return null;
}
