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

        // a callback which is called when the content in the callview changes
        // in a way that is likely to cause a resize.
        onResize: React.PropTypes.func,

        // render ongoing audio call details - useful when in LeftPanel
        showVoice: React.PropTypes.bool,
    },

    getInitialState: function() {
        return {
            // the call this view is displaying (if any)
            call: null,
        };
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

            if (this.call) {
                this.setState({ call: call });
            }

        }
        else {
            call = CallHandler.getAnyActiveCall();
            this.setState({ call: call });
        }

        if (call) {
            call.setLocalVideoElement(this.getVideoView().getLocalVideoElement());
            call.setRemoteVideoElement(this.getVideoView().getRemoteVideoElement());
            // always use a separate element for audio stream playback.
            // this is to let us move CallView around the DOM without interrupting remote audio
            // during playback, by having the audio rendered by a top-level <audio/> element.
            // rather than being rendered by the main remoteVideo <video/> element.
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

        if (this.props.onResize) {
            this.props.onResize();
        }
    },

    getVideoView: function() {
        return this.refs.video;
    },

    render: function() {
        var VideoView = sdk.getComponent('voip.VideoView');

        var voice;
        if (this.state.call && this.state.call.type === "voice" && this.props.showVoice) {
            var callRoom = MatrixClientPeg.get().getRoom(this.state.call.roomId);
            voice = <div className="mx_CallView_voice" onClick={ this.props.onClick }>Active call ({ callRoom.name })</div>;
        }

        return (
            <div>
                <VideoView ref="video" onClick={ this.props.onClick }
                    onResize={ this.props.onResize }
                    maxHeight={ this.props.maxVideoHeight }
                />
                { voice }
            </div>
        );
    }
});

