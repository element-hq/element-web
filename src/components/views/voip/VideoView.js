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

'use strict';

var React = require('react');
var ReactDOM = require('react-dom');

var sdk = require('../../../index');
var dis = require('../../../dispatcher');

module.exports = React.createClass({
    displayName: 'VideoView',

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    getRemoteVideoElement: function() {
        return ReactDOM.findDOMNode(this.refs.remote);
    },

    getRemoteAudioElement: function() {
        return this.refs.remoteAudio;
    },

    getLocalVideoElement: function() {
        return ReactDOM.findDOMNode(this.refs.local);
    },

    setContainer: function(c) {
        this.container = c;
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'video_fullscreen':
                if (!this.container) {
                    return;
                }
                var element = this.container;
                if (payload.fullscreen) {
                    var requestMethod = (
                        element.requestFullScreen ||
                        element.webkitRequestFullScreen ||
                        element.mozRequestFullScreen ||
                        element.msRequestFullscreen
                    );
                    requestMethod.call(element);
                }
                else {
                    var exitMethod = (
                        document.exitFullscreen ||
                        document.mozCancelFullScreen ||
                        document.webkitExitFullscreen ||
                        document.msExitFullscreen
                    );
                    if (exitMethod) {
                        exitMethod.call(document);
                    }
                }
                break;
        }
    },

    render: function() {
        var VideoFeed = sdk.getComponent('voip.VideoFeed');
        return (
            <div className="mx_VideoView" ref={this.setContainer} onClick={ this.props.onClick }>
                <div className="mx_VideoView_remoteVideoFeed">
                    <VideoFeed ref="remote" onResize={this.props.onResize}/>
                    <audio ref="remoteAudio"/>
                </div>
                <div className="mx_VideoView_localVideoFeed">                
                    <VideoFeed ref="local"/>
                </div>
            </div>
        );
    }
});
