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

    propTypes: {
        member: React.PropTypes.any, // RoomMember
        onFinished: React.PropTypes.func,
        customDisplayName: React.PropTypes.string // for 3pid invites
    },

    getInitialState: function() {
        return {};
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        if (this.state.hover !== nextState.hover) return true;
        if (!this.props.member) { return false; } // e.g. 3pid members
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
        if (!this.props.member) { return; } // e.g. 3pid members

        dis.dispatch({
            action: 'view_user',
            member: this.props.member,
        });
    },

    _getDisplayName: function() {
        if (this.props.customDisplayName) {
            return this.props.customDisplayName;
        }
        return this.props.member.name;
    },

    getPowerLabel: function() {
        if (!this.props.member) {
            return this._getDisplayName();
        }
        var label = this.props.member.userId;
        if (this.state.isTargetMod) {
            label += " - Mod (" + this.props.member.powerLevelNorm + "%)";
        }
        return label;
    },

    render: function() {
        var member = this.props.member;
        var isMyUser = false;
        var name = this._getDisplayName();
        var active = -1;
        var presenceClass = "mx_MemberTile_offline";

        if (member) {
            if (member.user) {
                this.user_last_modified_time = member.user.getLastModifiedTime();

                // FIXME: make presence data update whenever User.presence changes...
                active = (
                    (Date.now() - (member.user.lastPresenceTs - member.user.lastActiveAgo)) || -1
                );

                if (member.user.presence === "online") {
                    presenceClass = "mx_MemberTile_online";
                }
                else if (member.user.presence === "unavailable") {
                    presenceClass = "mx_MemberTile_unavailable";
                }
            }
            this.member_last_modified_time = member.getLastModifiedTime();
            isMyUser = MatrixClientPeg.get().credentials.userId == member.userId;

            // if (this.props.member && this.props.member.powerLevelNorm > 0) {
            //     var img = "img/p/p" + Math.floor(20 * this.props.member.powerLevelNorm / 100) + ".png";
            //     power = <img src={ img } className="mx_MemberTile_power" width="44" height="44" alt=""/>;
            // }

            var power;
            if (this.props.member) {
                var powerLevel = this.props.member.powerLevel;
                if (powerLevel >= 50 && powerLevel < 99) {
                    power = <img src="img/mod.svg" className="mx_MemberTile_power" width="16" height="17" alt="Mod"/>;
                }
                if (powerLevel >= 99) {
                    power = <img src="img/admin.svg" className="mx_MemberTile_power" width="16" height="17" alt="Admin"/>;
                }
            }
        }

        var mainClassName = "mx_MemberTile ";
        mainClassName += presenceClass;
        if (this.state.hover) {
            mainClassName += " mx_MemberTile_hover";
        }

        var nameEl;
        if (this.state.hover) {
            var presenceState = (member && member.user) ? member.user.presence : null;
            var PresenceLabel = sdk.getComponent("rooms.PresenceLabel");
            nameEl = (
                <div className="mx_MemberTile_details">
                    <img className="mx_MemberTile_chevron" src="img/member_chevron.png" width="8" height="12"/>
                    <div className="mx_MemberTile_userId">{ name }</div>
                    <PresenceLabel activeAgo={active}
                        presenceState={presenceState} />
                </div>
            );
        }
        else {
            nameEl = (
                <div className="mx_MemberTile_name">
                    { name }
                </div>
            );
        }

        var MemberAvatar = sdk.getComponent('avatars.MemberAvatar');

        return (
            <div className={mainClassName} title={ this.getPowerLabel() }
                    onClick={ this.onClick } onMouseEnter={ this.mouseEnter }
                    onMouseLeave={ this.mouseLeave }>
                <div className="mx_MemberTile_avatar">
                    <MemberAvatar member={this.props.member} width={36} height={36}
                        customDisplayName={this.props.customDisplayName} />
                    { power }
                </div>
                { nameEl }
            </div>
        );
    }
});
