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

module.exports = React.createClass({
    displayName: 'VideoFeed',

    propTypes: {
        // maxHeight style attribute for the video element
        maxHeight: React.PropTypes.number,

        // a callback which is called when the video element is resized
        // due to a change in video metadata
        onResize: React.PropTypes.func,
    },

    componentDidMount() {
        this.refs.vid.addEventListener('resize', this.onResize);
    },

    componentWillUnmount() {
        this.refs.vid.removeEventListener('resize', this.onResize);
    },

    onResize: function(e) {
        if(this.props.onResize) {
            this.props.onResize(e);
        }
    },

    render: function() {
        return (
            <video ref="vid" style={{maxHeight: this.props.maxHeight}}>
            </video>
        );
    },
});

