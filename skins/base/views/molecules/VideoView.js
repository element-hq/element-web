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

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");
var ComponentBroker = require('../../../../src/ComponentBroker');

var VideoFeed = ComponentBroker.get('atoms/VideoFeed');

module.exports = React.createClass({
    displayName: 'VideoView',

    getRemoteVideoElement: function() {
        return this.refs.remote.getDOMNode();
    },

    getLocalVideoElement: function() {
        return this.refs.local.getDOMNode();
    },

    render: function() {
        return (
            <div>
                <div>
                <VideoFeed ref="remote"/>
                </div>
                <div>
                <VideoFeed ref="local"/>
                </div>
            </div>
        );
    },
});