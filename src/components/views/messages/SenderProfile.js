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
    displayName: 'SenderProfile',

    propTypes: {
        mxEvent: React.PropTypes.object.isRequired, // event whose sender we're showing
        aux: React.PropTypes.string, // stuff to go after the sender name, if anything
        onClick: React.PropTypes.func,
    },

    render: function() {
        var mxEvent = this.props.mxEvent;
        var name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();

        var msgtype = mxEvent.getContent().msgtype;
        if (msgtype && msgtype == 'm.emote') {
            return <span/>; // emote message must include the name so don't duplicate it
        }
        return (
            <span className="mx_SenderProfile" onClick={this.props.onClick}>
                {name} { this.props.aux }
            </span>
        );
    },
});

