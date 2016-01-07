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
var dis = require('../../../dispatcher');
var Modal = require("../../../Modal");

module.exports = React.createClass({
    displayName: 'MemberTile',

    getInitialState: function() {
        return {};
    },

    onLeaveClick: function() {
        dis.dispatch({
            action: 'leave_room',
            room_id: this.props.member.roomId,
        });
        this.props.onFinished();        
    },

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
        dis.dispatch({
            action: 'view_user',
            member: this.props.member,
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
        // if (this.props.member && this.props.member.powerLevelNorm > 0) {
        //     var img = "img/p/p" + Math.floor(20 * this.props.member.powerLevelNorm / 100) + ".png";
        //     power = <img src={ img } className="mx_MemberTile_power" width="44" height="44" alt=""/>;
        // }
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
        // if (isMyUser) name += " (me)"; // this does nothing other than introduce line wrapping and pain
        //var leave = isMyUser ? <img className="mx_MemberTile_leave" src="img/delete.png" width="10" height="10" onClick={this.onLeaveClick}/> : null;

        var nameEl;
        if (this.state.hover) {
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
                    <img className="mx_MemberTile_chevron" src="img/member_chevron.png" width="8" height="12"/>
                    <div className="mx_MemberTile_userId">{ name }</div>
                    { presence }
                </div>
        }
        else {
            nameEl =
                <div className="mx_MemberTile_name">
                    { name }
                </div>
        }

        var MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        return (
            <div className={mainClassName} title={ this.getPowerLabel() }
                    onClick={ this.onClick } onMouseEnter={ this.mouseEnter }
                    onMouseLeave={ this.mouseLeave }>
                <div className="mx_MemberTile_avatar">
                    <MemberAvatar member={this.props.member} width={36} height={36} />
                     { power }
                </div>
                { nameEl }
            </div>
        );
    }
});
