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
        member: React.PropTypes.any.isRequired, // RoomMember
    },

    getInitialState: function() {
        return {};
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        if (
            this.member_last_modified_time === undefined ||
            this.member_last_modified_time < nextProps.member.getLastModifiedTime()
        ) {
            return true;
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

    onClick: function(e) {
        dis.dispatch({
            action: 'view_user',
            member: this.props.member,
        });
    },

    _getDisplayName: function() {
        return this.props.member.name;
    },

    getPowerLabel: function() {
        return this.props.member.userId + " (power " + this.props.member.powerLevel + ")";
    },

    render: function() {
        var MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        var BaseAvatar = sdk.getComponent('avatars.BaseAvatar');
        var EntityTile = sdk.getComponent('rooms.EntityTile');

        var member = this.props.member;
        var name = this._getDisplayName();
        var active = -1;
        var presenceState = member.user ? member.user.presence : null;

        var av = (
            <MemberAvatar member={member} width={36} height={36} />
        );

        if (member.user) {
            this.user_last_modified_time = member.user.getLastModifiedTime();

            // FIXME: make presence data update whenever User.presence changes...
            active = (
                (Date.now() - (member.user.lastPresenceTs - member.user.lastActiveAgo)) || -1
            );
        }
        this.member_last_modified_time = member.getLastModifiedTime();
        
        return (
            <EntityTile {...this.props} presenceActiveAgo={active} presenceState={presenceState}
                avatarJsx={av} title={this.getPowerLabel()} onClick={this.onClick}
                shouldComponentUpdate={this.shouldComponentUpdate.bind(this)}
                name={name} powerLevel={this.props.member.powerLevel} />
        );
    }
});
