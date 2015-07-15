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
var MatrixClientPeg = require("../../../MatrixClientPeg");
var Matrix = require("matrix-js-sdk");
var dis = require("../../../dispatcher");

/*
 * State vars:
 * this.state.call = MatrixCall|null
 *
 * Props:
 * this.props.room = Room (JS SDK) - can be null (for singleton views)
 */

module.exports = {

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        this.setState({
            call: null
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

        switch (payload.action) {
            case 'place_call':
                if (this.state.call) {
                    return; // don't allow >1 call to be placed.
                }
                console.log("Place %s call in %s", payload.type, payload.room_id);
                var call = Matrix.createNewMatrixCall(
                    MatrixClientPeg.get(), payload.room_id
                );
                this._setCallListeners(call);
                this.setState({
                    call: call
                });
                if (payload.type === 'voice') {
                    call.placeVoiceCall();
                }
                else if (payload.type === 'video') {
                    var videoView = this.getVideoView();
                    call.placeVideoCall(
                        videoView.getRemoteVideoElement(),
                        videoView.getLocalVideoElement()
                    );
                }
                else {
                    console.error("Unknown call type: %s", payload.type);
                }
                break;
            case 'incoming_call':
                if (this.state.call) {
                    payload.call.hangup("busy");
                    return; // don't allow >1 call to be received.
                }
                this._setCallListeners(call);
                this.setState({
                    call: call
                });
                console.log("Incoming call: %s", payload.call);
                break;
            case 'hangup':
                if (!this.state.call) {
                    return; // no call to hangup
                }
                this.state.call.hangup();
                this.setState({
                    call: null
                });
                break;
            case 'answer':
                if (!this.state.call) {
                    return; // no call to answer
                }
                this.state.call.answer();
                break;
        }
    },

    _setCallListeners: function(call) {
        var self = this;
        call.on("error", function(err) {
            console.error("Call error: %s", err);
            console.error(err.stack);
            call.hangup();
            self.setState({
                call: null
            });
        });
        call.on("hangup", function() {
            self.setState({
                call: null
            });
        })
    }
};

