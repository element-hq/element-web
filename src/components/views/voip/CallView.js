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

module.exports = React.createClass({
    displayName: 'CallView',

    propTypes: {
        // js-sdk room object. If set, we will only show calls for the given
        // room; if not, we will show any active call.
        room: React.PropTypes.object,

        // A Conference Handler implementation
        // Must have a function signature:
        //  getConferenceCallForRoom(roomId: string): MatrixCall
        ConferenceHandler: React.PropTypes.object,

        // maxHeight style attribute for the video panel
        maxVideoHeight: React.PropTypes.number,

        // a callback which is called when the user clicks on the video div
        onClick: React.PropTypes.func,

        // a callback which is called when the video within the callview is
        // resized due to a change in video metadata
        onResize: React.PropTypes.func,
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        this.showCall();
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        // don't filter out payloads for room IDs other than props.room because
        // we may be interested in the conf 1:1 room
        if (payload.action !== 'call_state') {
            return;
        }
        this.showCall();
    },

    showCall: function() {
        var call;

        if (this.props.room) {
            var roomId = this.props.room.roomId;
            call = CallHandler.getCallForRoom(roomId) ||
                (this.props.ConferenceHandler ?
                 this.props.ConferenceHandler.getConferenceCallForRoom(roomId) :
                 null
                );
        }
        else {
            call = CallHandler.getAnyActiveCall();
        }

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
                call.confUserId ? "none" : "block"
            );
            this.getVideoView().getRemoteVideoElement().style.display = "block";
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
            <VideoView ref="video" onClick={ this.props.onClick }
                onResize={ this.props.onResize }
                maxHeight={ this.props.maxVideoHeight }
            />
        );
    }
});

