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
import {emojifyText} from '../../../HtmlUtils';


var PRESENCE_CLASS = {
    "offline": "mx_EntityTile_offline",
    "online": "mx_EntityTile_online",
    "unavailable": "mx_EntityTile_unavailable"
};


function presenceClassForMember(presenceState, lastActiveAgo) {
    // offline is split into two categories depending on whether we have
    // a last_active_ago for them.
    if (presenceState == 'offline') {
        if (lastActiveAgo) {
            return PRESENCE_CLASS['offline'] + '_beenactive';
        } else {
            return PRESENCE_CLASS['offline'] + '_neveractive';
        }
    } else if (presenceState) {
        return PRESENCE_CLASS[presenceState];
    } else {
        return PRESENCE_CLASS['offline'] + '_neveractive';
    }
}

module.exports = React.createClass({
    displayName: 'EntityTile',

    propTypes: {
        name: React.PropTypes.string,
        title: React.PropTypes.string,
        avatarJsx: React.PropTypes.any, // <BaseAvatar />
        className: React.PropTypes.string,
        presenceState: React.PropTypes.string,
        presenceLastActiveAgo: React.PropTypes.number,
        presenceLastTs: React.PropTypes.number,
        presenceCurrentlyActive: React.PropTypes.bool,
        showInviteButton: React.PropTypes.bool,
        shouldComponentUpdate: React.PropTypes.func,
        onClick: React.PropTypes.func,
        suppressOnHover: React.PropTypes.bool
    },

    getDefaultProps: function() {
        return {
            shouldComponentUpdate: function(nextProps, nextState) { return true; },
            onClick: function() {},
            presenceState: "offline",
            presenceLastActiveAgo: 0,
            presenceLastTs: 0,
            showInviteButton: false,
            suppressOnHover: false
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
        const presenceClass = presenceClassForMember(
            this.props.presenceState, this.props.presenceLastActiveAgo
        );

        var mainClassName = "mx_EntityTile ";
        mainClassName += presenceClass + (this.props.className ? (" " + this.props.className) : "");
        var nameEl;
        let nameHTML = emojifyText(this.props.name);

        if (this.state.hover && !this.props.suppressOnHover) {
            var activeAgo = this.props.presenceLastActiveAgo ?
                (Date.now() - (this.props.presenceLastTs - this.props.presenceLastActiveAgo)) : -1;

            mainClassName += " mx_EntityTile_hover";
            var PresenceLabel = sdk.getComponent("rooms.PresenceLabel");
            nameEl = (
                <div className="mx_EntityTile_details">
                    <img className="mx_EntityTile_chevron" src="img/member_chevron.png" width="8" height="12"/>
                    <div className="mx_EntityTile_name_hover" dangerouslySetInnerHTML={nameHTML}></div>
                    <PresenceLabel activeAgo={ activeAgo }
                        currentlyActive={this.props.presenceCurrentlyActive}
                        presenceState={this.props.presenceState} />
                </div>
            );
        }
        else {
            nameEl = (
                <div className="mx_EntityTile_name" dangerouslySetInnerHTML={nameHTML}>
                </div>
            );
        }

        var inviteButton;
        if (this.props.showInviteButton) {
            inviteButton = (
                <div className="mx_EntityTile_invite">
                    <img src="img/plus.svg" width="16" height="16" />
                </div>
            );
        }

        var power;
        var powerLevel = this.props.powerLevel;
        if (powerLevel >= 50 && powerLevel < 99) {
            power = <img src="img/mod.svg" className="mx_EntityTile_power" width="16" height="17" alt="Mod"/>;
        }
        if (powerLevel >= 99) {
            power = <img src="img/admin.svg" className="mx_EntityTile_power" width="16" height="17" alt="Admin"/>;
        }


        var MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        var BaseAvatar = sdk.getComponent('avatars.BaseAvatar');

        var av = this.props.avatarJsx || <BaseAvatar name={this.props.name} width={36} height={36} />;

        return (
            <div className={mainClassName} title={ this.props.title }
                    onClick={ this.props.onClick } onMouseEnter={ this.mouseEnter }
                    onMouseLeave={ this.mouseLeave }>
                <div className="mx_EntityTile_avatar">
                    { av }
                    { power }
                </div>
                { nameEl }
                { inviteButton }
            </div>
        );
    }
});
