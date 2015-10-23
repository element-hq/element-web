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
var classNames = require('classnames');
var Loader = require('react-loader');

var MemberListController = require('matrix-react-sdk/lib/controllers/organisms/MemberList')

var sdk = require('matrix-react-sdk')


module.exports = React.createClass({
    displayName: 'MemberList',
    mixins: [MemberListController],

    getInitialState: function() {
        return { editing: false };
    },

    memberSort: function(userIdA, userIdB) {
        var userA = this.memberDict[userIdA].user;
        var userB = this.memberDict[userIdB].user;

        var presenceMap = {
            online: 3,
            unavailable: 2,
            offline: 1
        };

        var presenceOrdA = userA ? presenceMap[userA.presence] : 0;
        var presenceOrdB = userB ? presenceMap[userB.presence] : 0;

        if (presenceOrdA != presenceOrdB) {
            return presenceOrdB - presenceOrdA;
        }

        var latA = userA ? (userA.lastPresenceTs - (userA.lastActiveAgo || userA.lastPresenceTs)) : 0;
        var latB = userB ? (userB.lastPresenceTs - (userB.lastActiveAgo || userB.lastPresenceTs)) : 0;

        return latB - latA;
    },

    makeMemberTiles: function(membership) {
        var MemberTile = sdk.getComponent("molecules.MemberTile");

        var self = this;
        return self.state.members.filter(function(userId) {
            var m = self.memberDict[userId];
            return m.membership == membership;
        }).map(function(userId) {
            var m = self.memberDict[userId];
            return (
                <MemberTile key={userId} member={m} ref={userId} />
            );
        });
    },

    onPopulateInvite: function(inputText, shouldSubmit) {
        // reset back to placeholder
        this.refs.invite.setValue("Invite", false, true);
        this.setState({ editing: false });
        if (!shouldSubmit) {
            return; // enter key wasn't pressed
        }
        this.onInvite(inputText);
    },

    onClickInvite: function(ev) {
        this.setState({ editing: true });
        this.refs.invite.onClickDiv();
        ev.stopPropagation();
        ev.preventDefault();
    },

    inviteTile: function() {
        var classes = classNames({
            mx_MemberTile: true,
            mx_MemberTile_inviteTile: true,
            mx_MemberTile_inviteEditing: this.state.editing,
        });

        var EditableText = sdk.getComponent("atoms.EditableText");
        if (this.state.inviting) {
            return (
                <Loader />
            );
        } else {
            return (
                <div className={ classes } onClick={ this.onClickInvite } >
                    <div className="mx_MemberTile_avatar"><img src="img/create-big.png" width="36" height="36" alt=""/></div>
                    <div className="mx_MemberTile_name">
                        <EditableText ref="invite" label="Invite" placeHolder="@user:domain.com" initialValue="" onValueChanged={this.onPopulateInvite}/>
                    </div>
                </div>
            );
        }
    },

    render: function() {
        var invitedSection = null;
        var invitedMemberTiles = this.makeMemberTiles('invite');
        if (invitedMemberTiles.length > 0) {
            invitedSection = (
                <div>
                    <h2>Invited</h2>
                    <div className="mx_MemberList_wrapper">
                        {invitedMemberTiles}
                    </div>
                </div>
            );
        }
        return (
            <div className="mx_MemberList">
                <div className="mx_MemberList_border">
                    <div>
                        <div className="mx_MemberList_wrapper">
                            {this.makeMemberTiles('join')}
                        </div>
                    </div>
                    {invitedSection}
                    {this.inviteTile()}
                </div>
            </div>
        );
    }
});

