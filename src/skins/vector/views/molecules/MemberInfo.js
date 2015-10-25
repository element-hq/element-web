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

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');
var MemberInfoController = require('matrix-react-sdk/lib/controllers/molecules/MemberInfo')

// FIXME: this should probably be an organism, to match with MemberList, not a molecule

module.exports = React.createClass({
    displayName: 'MemberInfo',
    mixins: [MemberInfoController],

    onCancel: function(e) {
        dis.dispatch({
            action: "view_user",
            member: null
        });
    },

    render: function() {
        var interactButton, kickButton, banButton, muteButton, giveModButton;
        if (this.props.member.userId === MatrixClientPeg.get().credentials.userId) {
            interactButton = <div className="mx_MemberInfo_field" onClick={this.onLeaveClick}>Leave room</div>;
        }
        else {
            interactButton = <div className="mx_MemberInfo_field" onClick={this.onChatClick}>Start chat</div>;
        }

        if (this.state.can.kick) {
            kickButton = <div className="mx_MemberInfo_field" onClick={this.onKick}>
                Kick
            </div>;
        }
        if (this.state.can.ban) {
            banButton = <div className="mx_MemberInfo_field" onClick={this.onBan}>
                Ban
            </div>;
        }
        if (this.state.can.mute) {
            var muteLabel = this.state.muted ? "Unmute" : "Mute";
            muteButton = <div className="mx_MemberInfo_field" onClick={this.onMuteToggle}>
                {muteLabel}
            </div>;
        }
        if (this.state.can.modifyLevel) {
            var giveOpLabel = this.state.isTargetMod ? "Revoke Mod" : "Make Mod";
            giveModButton = <div className="mx_MemberInfo_field" onClick={this.onModToggle}>
                {giveOpLabel}
            </div>
        }

        var MemberAvatar = sdk.getComponent('atoms.MemberAvatar');
        return (
            <div className="mx_MemberInfo">
                <img className="mx_MemberInfo_cancel" src="img/cancel-black.png" width="18" height="18" onClick={this.onCancel}/>
                <div className="mx_MemberInfo_avatar">
                    <MemberAvatar member={this.props.member} width={48} height={48} />
                </div>
                <h2>{ this.props.member.name }</h2>
                <div className="mx_MemberInfo_profileField">
                    { this.props.member.userId }
                </div>
                <div className="mx_MemberInfo_buttons">
                    {interactButton}
                    {muteButton}
                    {kickButton}
                    {banButton}
                    {giveModButton}
                </div>
            </div>
        );
    }
});
