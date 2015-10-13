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

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var sdk = require('matrix-react-sdk')
var ContextualMenu = require('../../../../ContextualMenu');
var MemberTileController = require('matrix-react-sdk/lib/controllers/molecules/MemberTile')

// The Lato WOFF doesn't include sensible combining diacritics, so Chrome chokes on rendering them.
// Revert to Arial when this happens, which on OSX works at least.
var zalgo = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/;

module.exports = React.createClass({
    displayName: 'MemberTile',
    mixins: [MemberTileController],

    shouldComponentUpdate: function(nextProps, nextState) {
        if (this.state.hover !== nextState.hover) return true;
        if (
            this.member_last_modified_time === undefined ||
            this.member_last_modified_time < nextProps.member.getLastModifiedTime()
        ) {
            return true
        }
        if (
            nextProps.member.user &&
            (this.user_last_modified_time === undefined ||
            this.user_last_modified_time < nextProps.member.user.getLastModifiedTime())
        ) {
            return true
        }
        return false;
    },

    mouseEnter: function(e) {
        this.setState({ 'hover': true });
    },

    mouseLeave: function(e) {
        this.setState({ 'hover': false });
    },

    onClick: function(e) {
        var self = this;
        self.setState({ 'menu': true });
        var MemberInfo = sdk.getComponent('molecules.MemberInfo');
        ContextualMenu.createMenu(MemberInfo, {
            member: self.props.member,
            right: window.innerWidth - e.pageX,
            top: e.pageY,
            onFinished: function() {
                self.setState({ 'menu': false });
            }
        });
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
        if (!user) return "Unknown";
        var presence = user.presence;
        if (presence === "online") return "Online";
        if (presence === "unavailable") return "Idle"; // XXX: is this actually right?
        if (presence === "offline") return "Offline";
        return "Unknown";
    },

    getPowerLabel: function() {
        var label = this.props.member.userId;
        if (this.state.isTargetMod) {
            label += " - Mod (" + this.props.member.powerLevelNorm + "%)";
        }
        return label;
    },

    render: function() {
        this.member_last_modified_time = this.props.member.getLastModifiedTime();
        if (this.props.member.user) {
            this.user_last_modified_time = this.props.member.user.getLastModifiedTime();
        }

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
        if (this.state.hover || this.state.menu) {
            mainClassName += " mx_MemberTile_hover";
        }

        var name = this.props.member.name;
        // if (isMyUser) name += " (me)"; // this does nothing other than introduce line wrapping and pain
        var leave = isMyUser ? <img className="mx_MemberTile_leave" src="img/delete.png" width="10" height="10" onClick={this.onLeaveClick}/> : null;

        var nameClass = "mx_MemberTile_name";
        if (zalgo.test(name)) {
            nameClass += " mx_MemberTile_zalgo";
        }

        var nameEl;
        if (this.state.hover || this.state.menu) {
            var presence;
            // FIXME: make presence data update whenever User.presence changes...
            var active = this.props.member.user ? ((Date.now() - (this.props.member.user.lastPresenceTs - this.props.member.user.lastActiveAgo)) || -1) : -1;
            if (active >= 0) {
                presence = <div className="mx_MemberTile_presence">{ this.getPrettyPresence(this.props.member.user) } { this.getDuration(active) } ago</div>;
            }
            else {
                presence = <div className="mx_MemberTile_presence">{ this.getPrettyPresence(this.props.member.user) }</div>;
            }

            nameEl =
                <div className="mx_MemberTile_details">
                    { leave }
                    <div className="mx_MemberTile_userId">{ this.props.member.userId }</div>
                    { presence }
                </div>
        }
        else {
            nameEl =
                <div className={nameClass}>
                    { name }
                </div>
        }

        var MemberAvatar = sdk.getComponent('atoms.MemberAvatar');
        return (
            <div className={mainClassName} title={ this.getPowerLabel() } onClick={ this.onClick } onMouseEnter={ this.mouseEnter } onMouseLeave={ this.mouseLeave }>
                <div className="mx_MemberTile_avatar">
                    <MemberAvatar member={this.props.member} />
                     { power }
                </div>
                { nameEl }
            </div>
        );
    }
});
