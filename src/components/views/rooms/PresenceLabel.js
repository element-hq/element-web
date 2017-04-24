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

var MatrixClientPeg = require('../../../MatrixClientPeg');
var sdk = require('../../../index');

module.exports = React.createClass({
    displayName: 'PresenceLabel',

    propTypes: {
        // number of milliseconds ago this user was last active.
        // zero = unknown
        activeAgo: React.PropTypes.number,

        // if true, activeAgo is an approximation and "Now" should
        // be shown instead
        currentlyActive: React.PropTypes.bool,

        // offline, online, etc
        presenceState: React.PropTypes.string
    },

    getDefaultProps: function() {
        return {
            ago: -1,
            presenceState: null
        };
    },

    getDuration: function(time) {
        if (!time) return;
        var t = parseInt(time / 1000);
        var s = t % 60;
        var m = parseInt(t / 60) % 60;
        var h = parseInt(t / (60 * 60)) % 24;
        var d = parseInt(t / (60 * 60 * 24));
        if (t < 60) {
            if (t < 0) {
                return "0s";
            }
            return s + "s";
        }
        if (t < 60 * 60) {
            return m + "m";
        }
        if (t < 24 * 60 * 60) {
            return h + "h";
        }
        return d + "d ";
    },

    getPrettyPresence: function(presence) {
        if (presence === "online") return "Online";
        if (presence === "unavailable") return "Idle"; // XXX: is this actually right?
        if (presence === "offline") return "Offline";
        return "Unknown";
    },

    render: function() {
        if (this.props.activeAgo >= 0) {
            var ago = this.props.currentlyActive ? "" : "for " + (this.getDuration(this.props.activeAgo));
            // var ago = this.getDuration(this.props.activeAgo) + " ago";
            // if (this.props.currentlyActive) ago += " (now?)";
            return (
                <div className="mx_PresenceLabel">
                    { this.getPrettyPresence(this.props.presenceState) } { ago }
                </div>
            );
        }
        else {
            return (
                <div className="mx_PresenceLabel">
                    { this.getPrettyPresence(this.props.presenceState) }
                </div>
            );
        }
    }
});
