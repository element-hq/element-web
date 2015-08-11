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
var MemberInfoController = require("../../../../src/controllers/molecules/MemberInfo");

module.exports = React.createClass({
    displayName: 'MemberInfo',
    mixins: [MemberInfoController],

    componentDidMount: function() {
        var self = this;

        var memberInfo = this.getDOMNode();
        var memberListScroll = document.getElementsByClassName("mx_MemberList_border")[0];
        if (memberListScroll) {
            memberInfo.style.top = (memberInfo.parentElement.offsetTop - memberListScroll.scrollTop) + "px";
        }
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

    render: function() {
        var activeAgo = "unknown";
        if (this.state.active >= 0) {
            activeAgo = this.getDuration(this.state.active);
        }
        var kickButton, banButton, muteButton, giveModButton;
        if (this.state.can.kick) {
            kickButton = <div className="mx_MemberInfo_button" onClick={this.onKick}>
                Kick
            </div>;
        }
        if (this.state.can.ban) {
            banButton = <div className="mx_MemberInfo_button" onClick={this.onBan}>
                Ban
            </div>;
        }
        if (this.state.can.mute) {
            var muteLabel = this.state.muted ? "Unmute" : "Mute";
            muteButton = <div className="mx_MemberInfo_button" onClick={this.onMuteToggle}>
                {muteLabel}
            </div>;
        }
        if (this.state.can.modifyLevel) {
            var giveOpLabel = this.state.isTargetMod ? "Revoke Mod" : "Make Mod";
            giveModButton = <div className="mx_MemberInfo_button" onClick={this.onModToggle}>
                {giveOpLabel}
            </div>
        }

        var opLabel;
        if (this.state.isTargetMod) {
            var level = this.props.member.powerLevelNorm + "%";
            opLabel = <div className="mx_MemberInfo_field">Moderator ({level})</div>
        }
        return (
            <div className="mx_MemberInfo">
                <img className="mx_MemberInfo_chevron" src="img/chevron-right.png" width="9" height="16" />
                <div className="mx_MemberInfo_shim"></div>
                <div className="mx_MemberInfo_avatar">
                    <img className="mx_MemberInfo_avatarImg"
                         src={ this.props.member ? MatrixClientPeg.get().getAvatarUrlForMember(this.props.member, 128, 128, "crop") : null }
                         width="128" height="128" alt=""/>
                </div>
                <div className="mx_MemberInfo_field">{this.props.member.userId}</div>
                {opLabel}
                <div className="mx_MemberInfo_field">Presence: {this.state.presence}</div>
                <div className="mx_MemberInfo_field">Last active: {activeAgo}</div>
                <div className="mx_MemberInfo_button" onClick={this.onChatClick}>Start chat</div>
                {muteButton}
                {kickButton}
                {banButton}
                {giveModButton}
            </div>
        );
    }
});
