/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import {MatrixClientPeg} from './MatrixClientPeg';
import dis from './dispatcher/dispatcher';
import { EventStatus } from 'matrix-js-sdk';

export default class Resend {
    static resendUnsentEvents(room) {
        room.getPendingEvents().filter(function(ev) {
            return ev.status === EventStatus.NOT_SENT;
        }).forEach(function(event) {
            Resend.resend(event);
        });
    }

    static cancelUnsentEvents(room) {
        room.getPendingEvents().filter(function(ev) {
            return ev.status === EventStatus.NOT_SENT;
        }).forEach(function(event) {
            Resend.removeFromQueue(event);
        });
    }

    static resend(event) {
        const room = MatrixClientPeg.get().getRoom(event.getRoomId());
        MatrixClientPeg.get().resendEvent(event, room).then(function(res) {
            dis.dispatch({
                action: 'message_sent',
                event: event,
            });
        }, function(err) {
            // XXX: temporary logging to try to diagnose
            // https://github.com/vector-im/riot-web/issues/3148
            console.log('Resend got send failure: ' + err.name + '(' + err + ')');

            dis.dispatch({
                action: 'message_send_failed',
                event: event,
            });
        });
    }

    static removeFromQueue(event) {
        MatrixClientPeg.get().cancelPendingEvent(event);
    }
}
