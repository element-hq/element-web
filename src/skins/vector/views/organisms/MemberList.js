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

var MemberListController = require('matrix-react-sdk/lib/controllers/organisms/MemberList')
var GeminiScrollbar = require('react-gemini-scrollbar');

var sdk = require('matrix-react-sdk')


module.exports = React.createClass({
    displayName: 'MemberList',
    mixins: [MemberListController],

    getInitialState: function() {
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
        var MemberTile = sdk.getComponent("rooms.MemberTile");

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

    onPopulateInvite: function(e) {
        this.onInvite(this.refs.invite.value);
        e.preventDefault();
    },

    inviteTile: function() {
        if (this.state.inviting) {
            var Loader = sdk.getComponent("elements.Spinner");
            return (
                <Loader />
            );
        } else {
            return (
                <form onSubmit={this.onPopulateInvite}>
                    <input className="mx_MemberList_invite" ref="invite" placeholder="Invite another user"/>
                </form>
            );
        }
    },

    render: function() {
        var invitedSection = null;
        var invitedMemberTiles = this.makeMemberTiles('invite');
        if (invitedMemberTiles.length > 0) {
            invitedSection = (
                <div className="mx_MemberList_invited">
                    <h2>Invited</h2>
                    <div className="mx_MemberList_wrapper">
                        {invitedMemberTiles}
                    </div>
                </div>
            );
        }
        return (
            <div className="mx_MemberList">
                <GeminiScrollbar autoshow={true} className="mx_MemberList_border">
                    {this.inviteTile()}
                    <div>
                        <div className="mx_MemberList_wrapper">
                            {this.makeMemberTiles('join')}
                        </div>
                    </div>
                    {invitedSection}
                </GeminiScrollbar>
            </div>
        );
    }
});

