/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, EventStatus, type Room, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

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
