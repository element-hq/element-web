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
var classNames = require("classnames");

var SenderProfileController = require("../../../../src/controllers/molecules/SenderProfile");

// The Lato WOFF doesn't include sensible combining diacritics, so Chrome chokes on rendering them.
// Revert to Arial when this happens, which on OSX works at least.
var zalgo = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/;

module.exports = React.createClass({
    displayName: 'SenderProfile',
    mixins: [SenderProfileController],

    render: function() {
        var mxEvent = this.props.mxEvent;
        var name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();

        var classes = classNames({
            mx_SenderProfile: true,
            // taken from https://en.wikipedia.org/wiki/Combining_character
            mx_SenderProfile_zalgo: zalgo.test(name),
        });

        var msgtype = mxEvent.getContent().msgtype;
        if (msgtype && msgtype == 'm.emote') {
            name = ''; // emote message must include the name so don't duplicate it
        }
        return (
            <span className={classes}>
                {name}
            </span>
        );
    },
});

