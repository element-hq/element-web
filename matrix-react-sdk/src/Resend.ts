/*
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent, EventStatus } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import dis from "./dispatcher/dispatcher";

export default class Resend {
    public static resendUnsentEvents(room: Room): Promise<void[]> {
        return Promise.all(
            room
                .getPendingEvents()
                .filter(function (ev: MatrixEvent) {
                    return ev.status === EventStatus.NOT_SENT;
                })
                .map(function (event: MatrixEvent) {
                    return Resend.resend(room.client, event);
                }),
        );
    }

    public static cancelUnsentEvents(room: Room): void {
        room.getPendingEvents()
            .filter(function (ev: MatrixEvent) {
                return ev.status === EventStatus.NOT_SENT;
            })
            .forEach(function (event: MatrixEvent) {
                Resend.removeFromQueue(room.client, event);
            });
    }

    public static resend(client: MatrixClient, event: MatrixEvent): Promise<void> {
        const room = client.getRoom(event.getRoomId())!;
        return client.resendEvent(event, room).then(
            function (res) {
                dis.dispatch({
                    action: "message_sent",
                    event: event,
                });
            },
            function (err: Error) {
                // XXX: temporary logging to try to diagnose
                // https://github.com/vector-im/element-web/issues/3148
                logger.log("Resend got send failure: " + err.name + "(" + err + ")");
            },
        );
    }

    public static removeFromQueue(client: MatrixClient, event: MatrixEvent): void {
        client.cancelPendingEvent(event);
    }
}
