/*
 Copyright 2017 Travis Ralston

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

import React from "react";
import * as sdk from "../../../index";
import MatrixClientPeg from "../../../MatrixClientPeg";
import AccessibleButton from '../elements/AccessibleButton';
import Presence from "../../../Presence";
import dispatcher from "../../../dispatcher";

module.exports = React.createClass({
    displayName: 'MemberPresenceAvatar',

    propTypes: {
        member: React.PropTypes.object.isRequired,
        width: React.PropTypes.number,
        height: React.PropTypes.number,
        resizeMethod: React.PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            width: 40,
            height: 40,
            resizeMethod: 'crop',
        };
    },

    getInitialState: function() {
        const presenceState = this.props.member.user.presence;
        return {
            status: presenceState,
        };
    },

    componentWillMount: function() {
        MatrixClientPeg.get().on("User.presence", this.onUserPresence);
        this.dispatcherRef = dispatcher.register(this.onAction);
    },

    componentWillUnmount: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("User.presence", this.onUserPresence);
        }
        dispatcher.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        if (payload.action !== "self_presence_updated") return;
        if (this.props.member.userId !== MatrixClientPeg.get().getUserId()) return;
        this.setState({
            status: payload.statusInfo.presence,
            message: payload.statusInfo.status_msg,
        });
    },

    onUserPresence: function(event, user) {
        if (user.userId !== MatrixClientPeg.get().getUserId()) return;
        this.setState({
            status: user.presence,
            message: user.presenceStatusMsg,
        });
    },

    onClick: function() {
        if (Presence.getState() === "online") {
            Presence.setState("unavailable", "This is a message", true);
        } else {
            Presence.stopMaintainingStatus();
        }
        console.log("CLICK");

        const presenceState = this.props.member.user.presence;
        const presenceLastActiveAgo = this.props.member.user.lastActiveAgo;
        const presenceLastTs = this.props.member.user.lastPresenceTs;
        const presenceCurrentlyActive = this.props.member.user.currentlyActive;
        const presenceMessage = this.props.member.user.presenceStatusMsg;

        console.log({
            presenceState,
            presenceLastActiveAgo,
            presenceLastTs,
            presenceCurrentlyActive,
            presenceMessage,
        });
    },

    render: function() {
        const MemberAvatar = sdk.getComponent("avatars.MemberAvatar");

        let onClickFn = null;
        if (this.props.member.userId === MatrixClientPeg.get().getUserId()) {
            onClickFn = this.onClick;
        }

        const avatarNode = (
            <MemberAvatar member={this.props.member} width={this.props.width} height={this.props.height}
                          resizeMethod={this.props.resizeMethod}/>
        );
        const statusNode = (
            <span className={"mx_MemberPresenceAvatar_status mx_MemberPresenceAvatar_status_" + this.state.status}/>
        );

        let avatar = (
            <div className="mx_MemberPresenceAvatar">
                {avatarNode}
                {statusNode}
            </div>
        );
        if (onClickFn) {
            avatar = (
                <AccessibleButton onClick={onClickFn} className="mx_MemberPresenceAvatar" element="div">
                    {avatarNode}
                    {statusNode}
                </AccessibleButton>
            );
        }
        return avatar;
    },
});
