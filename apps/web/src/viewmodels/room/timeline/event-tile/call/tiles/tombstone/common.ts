/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import { EventType, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type IRTCNotificationContent } from "matrix-js-sdk/src/matrixrtc";

import { formatTime } from "../../../../../../../DateUtils";

function getTs(event: MatrixEvent): number {
    if (event.getType() === EventType.RTCNotification) {
        /**
         * According to the spec:
         * Receivers SHOULD use origin_server_ts if |sender_ts - origin_server_ts| > 20000 ms.
         */
        const content = event.getContent<IRTCNotificationContent>();
        const senderTs = content["sender_ts"];
        const originServerTs = event.getTs();
        const ts = Math.abs(senderTs - originServerTs) > 20000 ? originServerTs : senderTs;
        return ts;
    } else return event.getTs();
}

/**
 * Get the time at which a call took place from a given rtc notification event.
 * @param event The notification event
 * @param showTwelveHour Whether the time is to be shown in 12 hour format
 * @returns A formatted time string
 */
export function getTimeFromEvent(event: MatrixEvent, showTwelveHour: boolean): string {
    const ts = getTs(event);
    const date = new Date(ts);
    const timestamp = formatTime(date, showTwelveHour);
    return timestamp;
}
