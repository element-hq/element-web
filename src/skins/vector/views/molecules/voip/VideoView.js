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

var React = require('react');

var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher')
var VideoViewController = require('matrix-react-sdk/lib/controllers/molecules/voip/VideoView')

module.exports = React.createClass({
    displayName: 'VideoView',
    mixins: [VideoViewController],

    componentWillMount: function() {
        dis.register(this.onAction);
    },

    getRemoteVideoElement: function() {
        return this.refs.remote.getDOMNode();
    },

    getLocalVideoElement: function() {
        return this.refs.local.getDOMNode();
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'video_fullscreen':
                var element = this.refs.container.getDOMNode();
                var requestMethod = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || element.msRequestFullscreen;
                requestMethod.call(element);
                break;
        }
    },

    render: function() {
        var VideoFeed = sdk.getComponent('atoms.voip.VideoFeed');
        return (
            <div className="mx_VideoView" ref="container">
                <div className="mx_VideoView_remoteVideoFeed">
                    <VideoFeed ref="remote"/>
                </div>
                <div className="mx_VideoView_localVideoFeed">                
                    <VideoFeed ref="local"/>
                </div>
            </div>
        );
    }
});
