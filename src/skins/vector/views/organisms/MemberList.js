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

var sdk = require('matrix-react-sdk')


module.exports = React.createClass({
    displayName: 'MemberList',
    mixins: [MemberListController],

    getInitialState: function() {
        return { editing: false };
    },

    makeMemberTiles: function() {
        var MemberTile = sdk.getComponent("molecules.MemberTile");

        if (!self.memberDict) {
            return null;
        }

        var self = this;
        return Object.keys(self.memberDict).map(function(userId) {
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
        return (
            <div className={ classes } onClick={ this.onClickInvite } >
                <div className="mx_MemberTile_avatar"><img src="img/create-big.png" width="40" height="40" alt=""/></div>            
                <div className="mx_MemberTile_name">
                    <EditableText ref="invite" label="Invite" placeHolder="@user:domain.com" initialValue="" onValueChanged={this.onPopulateInvite}/>
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
                <div className="mx_MemberList_border">
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

