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

var Avatar = require("../../../Avatar");
var MatrixClientPeg = require('../../../MatrixClientPeg');
var sdk = require('../../../index');
var dis = require('../../../dispatcher');
var Modal = require("../../../Modal");

module.exports = React.createClass({
    displayName: 'UserTile',

    propTypes: {
        user: React.PropTypes.any.isRequired, // User
        onInviteClick: React.PropTypes.func, //onInviteClick(User)
        showInvite: React.PropTypes.bool,
        onClick: React.PropTypes.func
    },

    getInitialState: function() {
        return {};
    },

    getDefaultProps: function() {
        return {
            onClick: function() {},
            onInviteClick: function() {},
            showInvite: false
        };
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        if (this.state.hover !== nextState.hover) return true;
        return false;
    },

    mouseEnter: function(e) {
        this.setState({ 'hover': true });
    },

    mouseLeave: function(e) {
        this.setState({ 'hover': false });
    },

    render: function() {
        var user = this.props.user;
        var name = user.displayName || user.userId;
        var isMyUser = MatrixClientPeg.get().credentials.userId == user.userId;
        var active = -1;
        var presenceClass = "mx_MemberTile_offline";

        this.user_last_modified_time = user.getLastModifiedTime();

        // FIXME: make presence data update whenever User.presence changes...
        active = (
            (Date.now() - (user.lastPresenceTs - user.lastActiveAgo)) || -1
        );

        if (user.presence === "online") {
            presenceClass = "mx_MemberTile_online";
        }
        else if (user.presence === "unavailable") {
            presenceClass = "mx_MemberTile_unavailable";
        }


        var mainClassName = "mx_MemberTile ";
        mainClassName += presenceClass;
        if (this.state.hover) {
            mainClassName += " mx_MemberTile_hover";
        }

        var nameEl;
        if (this.state.hover) {
            var PresenceLabel = sdk.getComponent("rooms.PresenceLabel");
            nameEl = (
                <div className="mx_MemberTile_details">
                    <img className="mx_MemberTile_chevron" src="img/member_chevron.png" width="8" height="12"/>
                    <div className="mx_MemberTile_userId">{ name }</div>
                    <PresenceLabel activeAgo={active}
                        presenceState={user.presence} />
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

        var BaseAvatar = sdk.getComponent('avatars.BaseAvatar');

        if (this.props.showInvite) {
            // TODO
        }

        return (
            <div className={mainClassName} title={ user.userId }
                    onClick={ this.props.onClick } onMouseEnter={ this.mouseEnter }
                    onMouseLeave={ this.mouseLeave }>
                <div className="mx_MemberTile_avatar">
                    <BaseAvatar width={36} height={36} name={name} idName={user.userId}
                        url={ Avatar.avatarUrlForUser(user, 36, 36, "crop") } />
                </div>
                { nameEl }
            </div>
        );
    }
});
