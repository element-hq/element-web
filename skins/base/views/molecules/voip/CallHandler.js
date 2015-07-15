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

var MatrixClientPeg = require("../../../../../src/MatrixClientPeg");
var ComponentBroker = require('../../../../../src/ComponentBroker');
var CallHandlerController = require(
    "../../../../../src/controllers/molecules/voip/CallHandler"
);
var VideoView = ComponentBroker.get('molecules/voip/VideoView');

module.exports = React.createClass({
    displayName: 'CallHandler',
    mixins: [CallHandlerController],

    getVideoView: function() {
        return this.refs.video;
    },

    render: function(){
        if (this.state && this.state.call) {
            if (this.state.call.type === "video") {
                return (
                    <VideoView ref="video"/>
                );
            }
            else if (this.state.call.type === "voice") {
                // <WaveformView /> in the future.
                return (
                    <div></div>
                );
            }
        }
        return (
            <div></div>
        );
    }
});