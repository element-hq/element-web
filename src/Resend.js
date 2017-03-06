/*
Copyright 2015, 2016 OpenMarket Ltd

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

var MatrixClientPeg = require('./MatrixClientPeg');
var dis = require('./dispatcher');
var sdk = require('./index');
var Modal = require('./Modal');
import { EventStatus } from 'matrix-js-sdk';

module.exports = {
    resendUnsentEvents: function(room) {
        room.getPendingEvents().filter(function(ev) {
            return ev.status === EventStatus.NOT_SENT;
        }).forEach(function(event) {
            module.exports.resend(event);
        });
    },
    cancelUnsentEvents: function(room) {
        room.getPendingEvents().filter(function(ev) {
            return ev.status === EventStatus.NOT_SENT;
        }).forEach(function(event) {
            module.exports.removeFromQueue(event);
        });
    },
    resend: function(event) {
        const room = MatrixClientPeg.get().getRoom(event.getRoomId());
        MatrixClientPeg.get().resendEvent(
            event, room
        ).done(function(res) {
            dis.dispatch({
                action: 'message_sent',
                event: event
            });
        }, function(err) {
            // XXX: temporary logging to try to diagnose
            // https://github.com/vector-im/riot-web/issues/3148
            console.log('Resend got send failure: ' + err.name + '('+err+')');
            if (err.name === "UnknownDeviceError") {
                dis.dispatch({
                    action: 'unknown_device_error',
                    err: err,
                    room: room,
                });
            }

            dis.dispatch({
                action: 'message_send_failed',
                event: event
            });
        });
    },
    removeFromQueue: function(event) {
        MatrixClientPeg.get().cancelPendingEvent(event);
        dis.dispatch({
            action: 'message_send_cancelled',
            event: event
        });
    },
};
