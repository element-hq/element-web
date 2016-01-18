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


var PRESENCE_CLASS = {
    "offline": "mx_MemberTile_offline",
    "online": "mx_MemberTile_online",
    "unavailable": "mx_MemberTile_unavailable"
};

module.exports = React.createClass({
    displayName: 'EntityTile',

    propTypes: {
        name: React.PropTypes.string,
        title: React.PropTypes.string,
        avatarJsx: React.PropTypes.any, // <BaseAvatar />
        presenceState: React.PropTypes.string,
        presenceActiveAgo: React.PropTypes.number,
        showInviteButton: React.PropTypes.bool,
        shouldComponentUpdate: React.PropTypes.func,
        onClick: React.PropTypes.func
    },

    getDefaultProps: function() {
        return {
            shouldComponentUpdate: function(nextProps, nextState) { return false; },
            onClick: function() {},
            presenceState: "offline",
            presenceActiveAgo: -1,
            showInviteButton: false,
        };
    },

    getInitialState: function() {
        return {
            hover: false
        };
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        if (this.state.hover !== nextState.hover) return true;
        return this.props.shouldComponentUpdate(nextProps, nextState);
    },

    mouseEnter: function(e) {
        this.setState({ 'hover': true });
    },

    mouseLeave: function(e) {
        this.setState({ 'hover': false });
    },

    render: function() {
        var presenceClass = PRESENCE_CLASS[this.props.presenceState];
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
                    <div className="mx_MemberTile_userId">{ this.props.name }</div>
                    <PresenceLabel activeAgo={this.props.presenceActiveAgo}
                        presenceState={this.props.presenceState} />
                </div>
            );
        }
        else {
            nameEl = (
                <div className="mx_MemberTile_name">
                    { this.props.name }
                </div>
            );
        }

        var MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        var BaseAvatar = sdk.getComponent('avatars.BaseAvatar');

        var av = this.props.avatarJsx || <BaseAvatar name={name} width={36} height={36} />;

        return (
            <div className={mainClassName} title={ this.props.title }
                    onClick={ this.props.onClick } onMouseEnter={ this.mouseEnter }
                    onMouseLeave={ this.mouseLeave }>
                <div className="mx_MemberTile_avatar">
                    {av}
                </div>
                { nameEl }
            </div>
        );
    }
});
