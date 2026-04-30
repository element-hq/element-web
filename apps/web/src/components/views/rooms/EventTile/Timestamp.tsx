/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { MessageTimestampView } from "@element-hq/web-shared-components";

import type { MessageTimestampViewModel } from "../../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel";
import { Icon as LateIcon } from "../../../../../res/img/sensor.svg";

/** Props for rendering a parent-owned timestamp view model. */
type TimestampProps = {
    /** Received timestamp in milliseconds, when the event arrived later than it was sent. */
    receivedTs?: number;
    /** Parent-owned timestamp view model. */
    vm: MessageTimestampViewModel;
};

/** Renders a timestamp view model with the optional late-arrival indicator. */
export function Timestamp({ vm, receivedTs }: Readonly<TimestampProps>): JSX.Element {
    return (
        <>
            {receivedTs ? <LateIcon className="mx_MessageTimestamp_lateIcon" width="16" height="16" /> : undefined}
            <MessageTimestampView vm={vm} className="mx_MessageTimestamp" />
        </>
    );
}
