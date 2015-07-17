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

var dis = require("../../../dispatcher");
var CallHandler = require("../../../CallHandler");

module.exports = {
    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    getInitialState: function() {
        return {
            incomingCallRoomId: null
        }
    },

    onAction: function(payload) {
        if (payload.action !== 'call_state') {
            return;
        }
        var call = CallHandler.getCall(payload.room_id);
        if (!call || call.call_state !== 'ringing') {
            this.setState({
                incomingCallRoomId: null
            });
            this.getRingAudio().pause();
            return;
        }
        if (call.call_state === "ringing") {
            this.getRingAudio().load();
            this.getRingAudio().play();
        }
        else {
            this.getRingAudio().pause();
        }

        this.setState({
            incomingCallRoomId: call.roomId
        });
    },

    onAnswerClick: function() {
        dis.dispatch({
            action: 'answer',
            room_id: this.state.incomingCallRoomId
        });
    },
    onRejectClick: function() {
        dis.dispatch({
            action: 'hangup',
            room_id: this.state.incomingCallRoomId
        });
    }
};

