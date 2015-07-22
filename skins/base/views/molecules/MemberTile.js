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

    render: function() {
        var isMyUser = MatrixClientPeg.get().credentials.userId == this.props.member.userId;

        var power;
        if (this.props.member) {
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

        var name = this.props.member.name;
        if (isMyUser) name += " (me)";
        var leave = isMyUser ? <span className="mx_MemberTile_leave" onClick={this.onLeaveClick}>X</span> : null;
        var nameEl;
        if (this.state.hover) {
            nameEl =
                <div className="mx_MemberTile_nameWrapper">
                    <MemberInfo member={this.props.member} />
                    <span className="mx_MemberTile_nameSpan">{name}</span>
                    {leave}
                </div>
        }
        else {
            nameEl =
                <div className="mx_MemberTile_name">
                    {name}
                    {leave}
                </div>
        }

        return (
            <div className={mainClassName} onMouseEnter={ this.mouseEnter } onMouseLeave={ this.mouseLeave }>
                <div className="mx_MemberTile_avatar">
                    <img className="mx_MemberTile_avatarImg"
                         src={ this.props.member ? MatrixClientPeg.get().getAvatarUrlForMember(this.props.member, 40, 40, "crop") : null }
                         width="40" height="40" alt=""/>
                         { power }
                </div>
                { nameEl }
            </div>
        );
    }
});
