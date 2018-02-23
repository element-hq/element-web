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
import PropTypes from 'prop-types';
import * as sdk from "../../../index";
import MatrixClientPeg from "../../../MatrixClientPeg";
import AccessibleButton from '../elements/AccessibleButton';
import Presence from "../../../Presence";
import dispatcher from "../../../dispatcher";
import * as ContextualMenu from "../../structures/ContextualMenu";
import SettingsStore from "../../../settings/SettingsStore";

// This is an avatar with presence information and controls on it.
module.exports = React.createClass({
    displayName: 'MemberPresenceAvatar',

    propTypes: {
        member: PropTypes.object.isRequired,
        width: PropTypes.number,
        height: PropTypes.number,
        resizeMethod: PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            width: 40,
            height: 40,
            resizeMethod: 'crop',
        };
    },

    getInitialState: function() {
        let presenceState = null;
        let presenceMessage = null;

        // RoomMembers do not necessarily have a user.
        if (this.props.member.user) {
            presenceState = this.props.member.user.presence;
            presenceMessage = this.props.member.user.presenceStatusMsg;
        }

        return {
            status: presenceState,
            message: presenceMessage,
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

    onStatusChange: function(newStatus) {
        Presence.stopMaintainingStatus();
        if (newStatus === "online") {
            Presence.setState(newStatus);
        } else Presence.setState(newStatus, null, true);
    },

    onClick: function(e) {
        const PresenceContextMenu = sdk.getComponent('context_menus.PresenceContextMenu');
        const elementRect = e.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = (elementRect.left + window.pageXOffset) - (elementRect.width / 2) + 3;
        const chevronOffset = 12;
        let y = elementRect.top + (elementRect.height / 2) + window.pageYOffset;
        y = y - (chevronOffset + 4); // where 4 is 1/4 the height of the chevron

        ContextualMenu.createMenu(PresenceContextMenu, {
            chevronOffset: chevronOffset,
            chevronFace: 'bottom',
            left: x,
            top: y,
            menuWidth: 125,
            currentStatus: this.state.status,
            onChange: this.onStatusChange,
        });

        e.stopPropagation();

        // XXX NB the following assumes that user is non-null, which is not valid
        // const presenceState = this.props.member.user.presence;
        // const presenceLastActiveAgo = this.props.member.user.lastActiveAgo;
        // const presenceLastTs = this.props.member.user.lastPresenceTs;
        // const presenceCurrentlyActive = this.props.member.user.currentlyActive;
        // const presenceMessage = this.props.member.user.presenceStatusMsg;
    },

    render: function() {
        const MemberAvatar = sdk.getComponent("avatars.MemberAvatar");

        let onClickFn = null;
        if (this.props.member.userId === MatrixClientPeg.get().getUserId()) {
            onClickFn = this.onClick;
        }

        const avatarNode = (
            <MemberAvatar member={this.props.member} width={this.props.width} height={this.props.height}
                          resizeMethod={this.props.resizeMethod} />
        );
        let statusNode = (
            <span className={"mx_MemberPresenceAvatar_status mx_MemberPresenceAvatar_status_" + this.state.status} />
        );

        // LABS: Disable presence management functions for now
        // Also disable the presence information if there's no status information
        if (!SettingsStore.isFeatureEnabled("feature_presence_management") || !this.state.status) {
            statusNode = null;
            onClickFn = null;
        }

        let avatar = (
            <div className="mx_MemberPresenceAvatar">
                { avatarNode }
                { statusNode }
            </div>
        );
        if (onClickFn) {
            avatar = (
                <AccessibleButton onClick={onClickFn} className="mx_MemberPresenceAvatar" element="div">
                    { avatarNode }
                    { statusNode }
                </AccessibleButton>
            );
        }
        return avatar;
    },
});
