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
 * this.state.call_state = the UI state of the call (see CallHandler)
 *
 * Props:
 * room (JS SDK Room)
 */

var React = require('react');
var dis = require("../../dispatcher");
var CallHandler = require("../../CallHandler");

module.exports = {
    propTypes: {
        room: React.PropTypes.object.isRequired,
        editing: React.PropTypes.bool,
        onSettingsClick: React.PropTypes.func,
        onSaveClick: React.PropTypes.func,
    },

    getDefaultProps: function() {
        return {
            editing: false,
            onSettingsClick: function() {},
            onSaveClick: function() {},
        };
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        if (this.props.room) {
            var call = CallHandler.getCallForRoom(this.props.room.roomId);
            var callState = call ? call.call_state : "ended";
            this.setState({
                call_state: callState
            });
        }
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        // don't filter out payloads for room IDs other than props.room because
        // we may be interested in the conf 1:1 room
        if (payload.action !== 'call_state' || !payload.room_id) {
            return;
        }
        var call = CallHandler.getCallForRoom(payload.room_id);
        var callState = call ? call.call_state : "ended";
        this.setState({
            call_state: callState
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
        var call = CallHandler.getCallForRoom(this.props.room.roomId);
        if (!call) { return; }
        dis.dispatch({
            action: 'hangup',
            // hangup the call for this room, which may not be the room in props
            // (e.g. conferences which will hangup the 1:1 room instead)
            room_id: call.roomId
        });
    }
};
