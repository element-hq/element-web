/*
Copyright 2015 OpenMarket Ltd

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

'use strict';

/*
 * Manages a list of all the currently active calls.
 *
 * This handler dispatches when voip calls are added/updated/removed from this list:
 * {
 *   action: 'call_state'
 *   room_id: <room ID of the call>,
 *   status: ringing|ringback|connected|ended|busy|stop_ringback|stop_ringing
 * }
 *
 * To know if the call was added/removed, this handler exposes a getter to
 * obtain the call for a room:
 *   CallHandler.getCall(roomId)
 *
 * This handler listens for and handles the following actions:
 * {
 *   action: 'place_call',
 *   type: 'voice|video',
 *   room_id: <room that the place call button was pressed in>
 * }
 *
 * {
 *   action: 'incoming_call'
 *   call: MatrixCall
 * }
 *
 * {
 *   action: 'hangup'
 *   room_id: <room that the hangup button was pressed in>
 * }
 *
 * {
 *   action: 'answer'
 *   room_id: <room that the answer button was pressed in>
 * }
 */

var MatrixClientPeg = require("./MatrixClientPeg");
var Matrix = require("matrix-js-sdk");
var dis = require("./dispatcher");

var calls = {
    //room_id: MatrixCall
};

function _setCallListeners(call) {
    call.on("error", function(err) {
        console.error("Call error: %s", err);
        console.error(err.stack);
        call.hangup();
        _setCallState(undefined, call.roomId, "ended");
    });
    call.on("hangup", function() {
        _setCallState(undefined, call.roomId, "ended");
    });
    // map web rtc states to dummy UI state
    // ringing|ringback|connected|ended|busy|stop_ringback|stop_ringing
    call.on("state", function(newState, oldState) {
        if (newState === "ringing") {
            _setCallState(call, call.roomId, "ringing");
        }
        else if (newState === "invite_sent") {
            _setCallState(call, call.roomId, "ringback");
        }
        else if (newState === "ended" && oldState === "connected") {
            _setCallState(call, call.roomId, "ended");
        }
        else if (newState === "ended" && oldState === "invite_sent" &&
                (call.hangupParty === "remote" ||
                (call.hangupParty === "local" && call.hangupReason === "invite_timeout")
                )) {
            _setCallState(call, call.roomId, "busy");
        }
        else if (oldState === "invite_sent") {
            _setCallState(call, call.roomId, "stop_ringback");
        }
        else if (oldState === "ringing") {
            _setCallState(call, call.roomId, "stop_ringing");
        }
        else if (newState === "connected") {
            _setCallState(call, call.roomId, "connected");
        }
    });
}

function _setCallState(call, roomId, status) {
    console.log(
        "Call state in %s changed to %s (%s)", roomId, status, (call ? call.state : "-")
    );
    calls[roomId] = call;
    if (call) {
        call.call_state = status;
    }
    dis.dispatch({
        action: 'call_state',
        room_id: roomId,
        status: status
    });
}

dis.register(function(payload) {
    switch (payload.action) {
        case 'place_call':
            if (calls[payload.room_id]) {
                return; // don't allow >1 call to be placed.
            }
            console.log("Place %s call in %s", payload.type, payload.room_id);
            var call = Matrix.createNewMatrixCall(
                MatrixClientPeg.get(), payload.room_id
            );
            _setCallListeners(call);
            _setCallState(call, call.roomId, "ringback");
            if (payload.type === 'voice') {
                call.placeVoiceCall();
            }
            else if (payload.type === 'video') {
                call.placeVideoCall(
                    payload.remote_element,
                    payload.local_element
                );
            }
            else {
                console.error("Unknown call type: %s", payload.type);
            }
            
            break;
        case 'incoming_call':
            if (calls[payload.call.roomId]) {
                payload.call.hangup("busy");
                return; // don't allow >1 call to be received, hangup newer one.
            }
            var call = payload.call;
            _setCallListeners(call);
            _setCallState(call, call.roomId, "ringing");
            break;
        case 'hangup':
            if (!calls[payload.room_id]) {
                return; // no call to hangup
            }
            calls[payload.room_id].hangup();
            _setCallState(null, payload.room_id, "ended");
            break;
        case 'answer':
            if (!calls[payload.room_id]) {
                return; // no call to answer
            }
            calls[payload.room_id].answer();
            _setCallState(calls[payload.room_id], payload.room_id, "connected");
            break;
    }
});

module.exports = {
    getCall: function(roomId) {
        return calls[roomId] || null;
    }
};