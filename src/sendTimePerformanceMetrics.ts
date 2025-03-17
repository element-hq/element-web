/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IContent, type MatrixClient } from "matrix-js-sdk/src/matrix";

/**
 * Decorates the given event content object with the "send start time". The
 * object will be modified in-place.
 * @param {object} content The event content.
 */
export function decorateStartSendingTime(content: IContent): void {
    content["io.element.performance_metrics"] = {
        sendStartTs: Date.now(),
    };
}

/**
 * Called when an event decorated with `decorateStartSendingTime()` has been sent
 * by the server (the client now knows the event ID).
 * @param {MatrixClient} client The client to send as.
 * @param {string} inRoomId The room ID where the original event was sent.
 * @param {string} forEventId The event ID for the decorated event.
 */
export function sendRoundTripMetric(client: MatrixClient, inRoomId: string, forEventId: string): void {
    // noinspection JSIgnoredPromiseFromCall
    client.sendEvent(inRoomId, "io.element.performance_metric", {
        "io.element.performance_metrics": {
            forEventId: forEventId,
            responseTs: Date.now(),
            kind: "send_time",
        },
    });
}
