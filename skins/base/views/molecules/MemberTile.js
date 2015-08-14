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
var Modal = require("../../../../src/Modal");
var MemberTileController = require("../../../../src/controllers/molecules/MemberTile");
var MemberInfo = ComponentBroker.get('molecules/MemberInfo');
var ErrorDialog = ComponentBroker.get("organisms/ErrorDialog");
var MemberAvatar = ComponentBroker.get('atoms/MemberAvatar');

// The Lato WOFF doesn't include sensible combining diacritics, so Chrome chokes on rendering them.
// Revert to Arial when this happens, which on OSX works at least.
var zalgo = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/;

module.exports = React.createClass({
    displayName: 'MemberTile',
    mixins: [MemberTileController],

    // XXX: should these be in the controller?
    getInitialState: function() {
        return { 'hover': false };
    },

    mouseEnter: function(e) {
        this.setState({ 'hover': true });
    },

    mouseLeave: function(e) {
        this.setState({ 'hover': false });
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

    getPrettyPresence: function(user) {
        var presence = user.presence;
        return presence.charAt(0).toUpperCase() + presence.slice(1);
    },

    render: function() {
        var isMyUser = MatrixClientPeg.get().credentials.userId == this.props.member.userId;

        var power;
        if (this.props.member && this.props.member.powerLevelNorm > 0) {
            var img = "img/p/p" + Math.floor(20 * this.props.member.powerLevelNorm / 100) + ".png";
            power = <img src={ img } className="mx_MemberTile_power" width="48" height="48" alt=""/>;
        }
        var presenceClass = "mx_MemberTile_offline";
        var mainClassName = "mx_MemberTile ";
        if (this.props.member.user) {
            if (this.props.member.user.presence === "online") {
                presenceClass = "mx_MemberTile_online";
            }
            else if (this.props.member.user.presence === "unavailable") {
                presenceClass = "mx_MemberTile_unavailable";
            }
        }
        mainClassName += presenceClass;
        if (this.state.hover) {
            mainClassName += " mx_MemberTile_hover";
        }

        var name = this.props.member.name;
        if (isMyUser) name += " (me)";
        var leave = isMyUser ? <img className="mx_MemberTile_leave" src="img/delete.png" width="10" height="10" onClick={this.onLeaveClick}/> : null;

        var nameClass = "mx_MemberTile_name";
        if (zalgo.test(name)) {
            nameClass += " mx_MemberTile_zalgo";
        }

        var nameEl;
        if (this.state.hover) {
            var presence;
            // FIXME: make presence data update whenever User.presence changes...
            var active = this.props.member.user.lastActiveAgo || -1;
            if (active >= 0) {
                presence = <div className="mx_MemberTile_presence">{ this.getPrettyPresence(this.props.member.user) } for { this.getDuration(active) }</div>;
            }
            else {
                presence = <div className="mx_MemberTile_presence">{ this.getPrettyPresence(this.props.member.user) }</div>;
            }

            nameEl =
                <div className="mx_MemberTile_details">
                    <MemberInfo member={this.props.member} />
                    <div className="mx_MemberTile_userId">{ this.props.member.userId }</div>
                    { presence }
                    { leave }
                </div>
        }
        else {
            nameEl =
                <div className={nameClass}>
                    { name }
                </div>
        }

        return (
            <div className={mainClassName} onMouseEnter={ this.mouseEnter } onMouseLeave={ this.mouseLeave }>
                <div className="mx_MemberTile_avatar">
                    <MemberAvatar member={this.props.member} />
                     { power }
                </div>
                { nameEl }
            </div>
        );
    }
});
