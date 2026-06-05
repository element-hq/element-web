/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { MessageTimestampView } from "@element-hq/web-shared-components";

import { type MessageTimestampViewModel } from "../../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel";
import { Icon as LateIcon } from "../../../../../res/img/sensor.svg";

/**
 * Props for the {@link MessageTimestampAdapter} component.
 */
interface MessageTimestampAdapterProps {
    /** View model owned by the parent event tile container. */
    vm: MessageTimestampViewModel;
    /** Whether the late-event icon should be rendered alongside the timestamp. */
    showLateIcon: boolean;
}

/**
 * Renders the timestamp badge for an event tile.
 */
export function MessageTimestampAdapter({ vm, showLateIcon }: Readonly<MessageTimestampAdapterProps>): JSX.Element {
    return (
        <>
            {showLateIcon ? <LateIcon className="mx_MessageTimestamp_lateIcon" width="16" height="16" /> : undefined}
            <MessageTimestampView vm={vm} className="mx_MessageTimestamp" />
        </>
    );
}
