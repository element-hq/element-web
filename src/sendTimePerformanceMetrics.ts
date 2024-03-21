/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { IContent, MatrixClient } from "matrix-js-sdk/src/matrix";

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
