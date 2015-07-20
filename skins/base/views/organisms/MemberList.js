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

var MemberListController = require("../../../../src/controllers/organisms/MemberList");

var ComponentBroker = require('../../../../src/ComponentBroker');

var MemberTile = ComponentBroker.get("molecules/MemberTile");
var EditableText = ComponentBroker.get("atoms/EditableText");


module.exports = React.createClass({
    displayName: 'MemberList',
    mixins: [MemberListController],

    // FIXME: combine this more nicely with the MemberInfo positioning stuff...
    onMemberListScroll: function(ev) {
        if (this.refs.memberListScroll) {
            var memberListScroll = this.refs.memberListScroll.getDOMNode();
            // offset the current MemberInfo bubble
            var memberInfo = document.getElementsByClassName("mx_MemberInfo")[0];
            if (memberInfo) {
                memberInfo.style.top = (memberInfo.parentElement.offsetTop - memberListScroll.scrollTop) + "px";
            }
        }
    },

    makeMemberTiles: function() {
        var self = this;
        return Object.keys(self.state.memberDict).map(function(userId) {
            var m = self.state.memberDict[userId];
            return (
                <MemberTile key={userId} member={m} />
            );
        });
    },

    onPopulateInvite: function(inputText, shouldSubmit) {
        // reset back to placeholder
        this.refs.invite.setValue("Invite", false, true);
        if (!shouldSubmit) {
            return; // enter key wasn't pressed
        }
        this.onInvite(inputText);
    },

    inviteTile: function() {
        if (this.state.inviting) {
            return (
                <div></div>
            );
        }
        return (
            <div className="mx_MemberTile">
                <div className="mx_MemberTile_avatar"><img src="img/create-big.png" width="40" height="40" alt=""/></div>            
                <div className="mx_MemberTile_name">
                    <EditableText ref="invite" placeHolder="Invite" onValueChanged={this.onPopulateInvite}/>
                </div>
            </div>
        );
    },

    render: function() {
        return (
            <div className="mx_MemberList">
                <div className="mx_MemberList_chevron">
                    <img src="img/chevron.png" width="24" height="13"/>
                </div>
                <div className="mx_MemberList_border" ref="memberListScroll" onScroll={ this.onMemberListScroll }>
                    <h2>Members</h2>
                    <div className="mx_MemberList_wrapper">
                        {this.makeMemberTiles()}
                        {this.inviteTile()}
                    </div>
                </div>
            </div>
        );
    }
});

