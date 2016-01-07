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
var React = require("react");
var dis = require("../../../dispatcher");
var CallHandler = require("../../../CallHandler");
var sdk = require('../../../index');
var MatrixClientPeg = require("../../../MatrixClientPeg");

/*
 * State vars:
 * this.state.call = MatrixCall|null
 *
 * Props:
 * this.props.room = Room (JS SDK)
 * this.props.ConferenceHandler = A Conference Handler implementation
 *                                Must have a function signature:
 *                                getConferenceCallForRoom(roomId: string): MatrixCall
 */

module.exports = React.createClass({
    displayName: 'CallView',

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        if (this.props.room) {
            this.showCall(this.props.room.roomId);
        }
        else {
            // XXX: why would we ever not have a this.props.room?
            var call = CallHandler.getAnyActiveCall();
            if (call) {
                this.showCall(call.roomId);
            }
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
        this.showCall(payload.room_id);
    },

    showCall: function(roomId) {
        var call = (
            CallHandler.getCallForRoom(roomId) ||
            (this.props.ConferenceHandler ?
                this.props.ConferenceHandler.getConferenceCallForRoom(roomId) :
                null
            )
        );
        if (call) {
            call.setLocalVideoElement(this.getVideoView().getLocalVideoElement());
            call.setRemoteVideoElement(this.getVideoView().getRemoteVideoElement());
            // give a separate element for audio stream playback - both for voice calls
            // and for the voice stream of screen captures
            call.setRemoteAudioElement(this.getVideoView().getRemoteAudioElement());
        }
        if (call && call.type === "video" && call.call_state !== "ended" && call.call_state !== "ringing") {
            // if this call is a conf call, don't display local video as the
            // conference will have us in it
            this.getVideoView().getLocalVideoElement().style.display = (
                call.confUserId ? "none" : "initial"
            );
            this.getVideoView().getRemoteVideoElement().style.display = "initial";
        }
        else {
            this.getVideoView().getLocalVideoElement().style.display = "none";
            this.getVideoView().getRemoteVideoElement().style.display = "none";
            dis.dispatch({action: 'video_fullscreen', fullscreen: false});
        }
    },

    getVideoView: function() {
        return this.refs.video;
    },

    render: function(){
        var VideoView = sdk.getComponent('voip.VideoView');
        return (
            <VideoView ref="video" onClick={ this.props.onClick }/>
        );
    }
});

