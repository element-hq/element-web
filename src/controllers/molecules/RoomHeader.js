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
 * State vars:
 * this.state.callState = OUTBOUND|INBOUND|IN_CALL|NO_CALL
 */

var dis = require("../../dispatcher");
var CallHandler = require("../../CallHandler");

module.exports = {
    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        this.setState({
            callState: "NO_CALL"
        });
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        // if we were given a room_id to track, don't handle anything else.
        if (payload.room_id && this.props.room && 
                this.props.room.roomId !== payload.room_id) {
            return;
        }
        if (payload.action !== 'call_state') {
            return;
        }
        var call = CallHandler.getCall(payload.room_id);
        var callState = 'NO_CALL';
        if (call && call.state !== 'ended') {
            if (call.state === 'connected') {
                callState = "IN_CALL";
            }
            else if (call.direction === 'outbound') {
                callState = "OUTBOUND";
            }
            else if (call.direction === 'inbound') {
                callState = "INBOUND";
            }
            else {
                console.error("Cannot determine call state.");
            }
        }
        this.setState({
            callState: callState
        });
    },

    onVideoClick: function() {
        dis.dispatch({
            action: 'place_call',
            type: "video",
            room_id: this.props.room.roomId
        });
    },
    onVoiceClick: function() {
        dis.dispatch({
            action: 'place_call',
            type: "voice",
            room_id: this.props.room.roomId
        });
    },
    onHangupClick: function() {
        dis.dispatch({
            action: 'hangup',
            room_id: this.props.room.roomId
        });
    },
    onAnswerClick: function() {
        dis.dispatch({
            action: 'answer',
            room_id: this.props.room.roomId
        });
    }
};

