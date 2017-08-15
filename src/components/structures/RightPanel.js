/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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

import React from 'react';
import { _t } from 'matrix-react-sdk/lib/languageHandler';
import sdk from 'matrix-react-sdk';
import Matrix from "matrix-js-sdk";
import dis from 'matrix-react-sdk/lib/dispatcher';
import MatrixClientPeg from 'matrix-react-sdk/lib/MatrixClientPeg';
import Analytics from 'matrix-react-sdk/lib/Analytics';
import rate_limited_func from 'matrix-react-sdk/lib/ratelimitedfunc';
import Modal from 'matrix-react-sdk/lib/Modal';
import AccessibleButton from 'matrix-react-sdk/lib/components/views/elements/AccessibleButton';

module.exports = React.createClass({
    displayName: 'RightPanel',

    propTypes: {
        // TODO: We're trying to move away from these being props, but we need to know
        // whether we should be displaying a room or group member list
        roomId: React.PropTypes.string, // if showing panels for a given room, this is set
        groupId: React.PropTypes.string, // if showing panels for a given group, this is set
        collapsed: React.PropTypes.bool, // currently unused property to request for a minimized view of the panel
    },

    Phase: {
        RoomMemberList: 'RoomMemberList',
        GroupMemberList: 'GroupMemberList',
        FilePanel: 'FilePanel',
        NotificationPanel: 'NotificationPanel',
        RoomMemberInfo: 'RoomMemberInfo',
        GroupMemberInfo: 'GroupMemberInfo',
    },

    componentWillMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        const cli = MatrixClientPeg.get();
        cli.on("RoomState.members", this.onRoomStateMember);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("RoomState.members", this.onRoomStateMember);
        }
    },

    getInitialState: function() {
        if (this.props.groupId) {
            return {
                phase: this.Phase.GroupMemberList,
            };
        } else {
            return {
                phase: this.Phase.RoomMemberList,
            };
        }
    },

    onMemberListButtonClick: function() {
        Analytics.trackEvent('Right Panel', 'Member List Button', 'click');
        this.setState({ phase: this.Phase.RoomMemberList });
    },

    onFileListButtonClick: function() {
        Analytics.trackEvent('Right Panel', 'File List Button', 'click');
        this.setState({ phase: this.Phase.FilePanel });
    },

    onNotificationListButtonClick: function() {
        Analytics.trackEvent('Right Panel', 'Notification List Button', 'click');
        this.setState({ phase: this.Phase.NotificationPanel });
    },

    onCollapseClick: function() {
        dis.dispatch({
            action: 'hide_right_panel',
        });
    },

    onInviteButtonClick: function() {
        if (MatrixClientPeg.get().isGuest()) {
            dis.dispatch({action: 'view_set_mxid'});
            return;
        }

        if (this.state.phase === this.Phase.GroupMemberList) {
            // TODO: display UserPickeDialog
        } else {
            // call UserPickerDialog
            dis.dispatch({
                action: 'view_invite',
                roomId: this.props.roomId,
            });
        }
    },

    onRoomStateMember: function(ev, state, member) {
        // redraw the badge on the membership list
        if (this.state.phase == this.Phase.RoomMemberList && member.roomId === this.props.roomId) {
            this._delayedUpdate();
        }
        else if (this.state.phase === this.Phase.RoomMemberInfo && member.roomId === this.props.roomId &&
                member.userId === this.state.member.userId) {
            // refresh the member info (e.g. new power level)
            this._delayedUpdate();
        }
    },

    _delayedUpdate: new rate_limited_func(function() {
        this.forceUpdate();
    }, 500),

    onAction: function(payload) {
        if (payload.action === "view_user") {
            dis.dispatch({
                action: 'show_right_panel',
            });
            if (payload.member) {
                this.setState({
                    phase: this.Phase.RoomMemberInfo,
                    member: payload.member,
                });
            } else {
                if (this.props.roomId) {
                    this.setState({
                        phase: this.Phase.RoomMemberList
                    });
                } else if (this.props.groupId) {
                    this.setState({
                        phase: this.Phase.GroupMemberList,
                        groupId: payload.groupId,
                        member: payload.member,
                    });
                }
            }
        } else if (payload.action === "view_group") {
            this.setState({
                phase: this.Phase.GroupMemberList,
                groupId: payload.groupId,
                member: null,
            });
        } else if (payload.action === "view_group_user") {
            this.setState({
                phase: this.Phase.GroupMemberInfo,
                groupId: payload.groupId,
                member: payload.member,
            });
        } else if (payload.action === "view_room") {
            this.setState({
                phase: this.Phase.RoomMemberList
            });
        }
    },

    render: function() {
        const MemberList = sdk.getComponent('rooms.MemberList');
        const GroupMemberList = sdk.getComponent('groups.GroupMemberList');
        const NotificationPanel = sdk.getComponent('structures.NotificationPanel');
        const FilePanel = sdk.getComponent('structures.FilePanel');
        const TintableSvg = sdk.getComponent("elements.TintableSvg");
        let inviteGroup;
        let panel;

        let filesHighlight;
        let membersHighlight;
        let notificationsHighlight;
        if (!this.props.collapsed) {
            if (this.state.phase == this.Phase.RoomMemberList || this.state.phase === this.Phase.RoomMemberInfo) {
                membersHighlight = <div className="mx_RightPanel_headerButton_highlight"></div>;
            }
            else if (this.state.phase == this.Phase.FilePanel) {
                filesHighlight = <div className="mx_RightPanel_headerButton_highlight"></div>;
            }
            else if (this.state.phase == this.Phase.NotificationPanel) {
                notificationsHighlight = <div className="mx_RightPanel_headerButton_highlight"></div>;
            }
        }

        let membersBadge;
        if ((this.state.phase == this.Phase.RoomMemberList || this.state.phase === this.Phase.RoomMemberInfo) && this.props.roomId) {
            const cli = MatrixClientPeg.get();
            const room = cli.getRoom(this.props.roomId);
            let user_is_in_room;
            if (room) {
                membersBadge = room.getJoinedMembers().length;
                user_is_in_room = room.hasMembershipState(
                    MatrixClientPeg.get().credentials.userId, 'join'
                );
            }

            if (user_is_in_room) {
                inviteGroup =
                    <AccessibleButton className="mx_RightPanel_invite" onClick={ this.onInviteButtonClick } >
                        <div className="mx_RightPanel_icon" >
                            <TintableSvg src="img/icon-invite-people.svg" width="35" height="35" />
                        </div>
                        <div className="mx_RightPanel_message">{ _t('Invite to this room') }</div>
                    </AccessibleButton>;
            }

        }

        let headerButtons = [];
        if (this.props.roomId) {
            headerButtons.push(
                <AccessibleButton className="mx_RightPanel_headerButton" key="_membersButton"
                        title={ _t('Members') } onClick={ this.onMemberListButtonClick }>
                    <div className="mx_RightPanel_headerButton_badge">{ membersBadge ? membersBadge : <span>&nbsp;</span>}</div>
                    <TintableSvg src="img/icons-people.svg" width="25" height="25"/>
                    { membersHighlight }
                </AccessibleButton>
            );
            headerButtons.push(
                <AccessibleButton
                        className="mx_RightPanel_headerButton mx_RightPanel_filebutton" key="_filesButton"
                        title={ _t('Files') } onClick={ this.onFileListButtonClick }>
                    <div className="mx_RightPanel_headerButton_badge">&nbsp;</div>
                    <TintableSvg src="img/icons-files.svg" width="25" height="25"/>
                    { filesHighlight }
                </AccessibleButton>
            );
            headerButtons.push(
                <AccessibleButton
                        className="mx_RightPanel_headerButton mx_RightPanel_notificationbutton" key="_notifsButton"
                        title={ _t('Notifications') } onClick={ this.onNotificationListButtonClick }>
                    <div className="mx_RightPanel_headerButton_badge">&nbsp;</div>
                    <TintableSvg src="img/icons-notifications.svg" width="25" height="25"/>
                    { notificationsHighlight }
                </AccessibleButton>
            );
        }

        if (this.props.roomId || this.props.groupId) {
            // Hiding the right panel hides it completely and relies on an 'expand' button
            // being put in the RoomHeader or GroupView header, so only show the minimise
            // button on these 2 screens or you won't be able to re-expand the panel.
            headerButtons.push(
                <div className="mx_RightPanel_headerButton mx_RightPanel_collapsebutton" key="_minimizeButton"
                    title={ _t("Hide panel") } onClick={ this.onCollapseClick }
                >
                    <TintableSvg src="img/minimise.svg" width="10" height="16"/>
                </div>
            );
        }

        if (!this.props.collapsed) {
            if (this.props.roomId && this.state.phase == this.Phase.RoomMemberList) {
                panel = <MemberList roomId={this.props.roomId} key={this.props.roomId} />
            } else if (this.props.groupId && this.state.phase == this.Phase.GroupMemberList) {
                panel = <GroupMemberList groupId={this.props.groupId} key={this.props.groupId} />;
                inviteGroup = (
                    <AccessibleButton className="mx_RightPanel_invite" onClick={ this.onInviteButtonClick } >
                        <div className="mx_RightPanel_icon" >
                            <TintableSvg src="img/icon-invite-people.svg" width="35" height="35" />
                        </div>
                        <div className="mx_RightPanel_message">{ _t('Invite to this group') }</div>
                    </AccessibleButton>
                );
            } else if (this.state.phase == this.Phase.RoomMemberInfo) {
                const MemberInfo = sdk.getComponent('rooms.MemberInfo');
                panel = <MemberInfo member={this.state.member} key={this.props.roomId || this.state.member.userId} />
            } else if (this.state.phase == this.Phase.GroupMemberInfo) {
                const GroupMemberInfo = sdk.getComponent('groups.GroupMemberInfo');
                panel = <GroupMemberInfo member={this.state.member} groupId={this.props.groupId} key={this.state.member.user_id} />;
            } else if (this.state.phase == this.Phase.NotificationPanel) {
                panel = <NotificationPanel />;
            } else if (this.state.phase == this.Phase.FilePanel) {
                panel = <FilePanel roomId={this.props.roomId} />;
            }
        }

        if (!panel) {
            panel = <div className="mx_RightPanel_blank"></div>;
        }

        let classes = "mx_RightPanel mx_fadable";
        if (this.props.collapsed) {
            classes += " collapsed";
        }

        return (
            <aside className={classes} style={{ opacity: this.props.opacity }}>
                <div className="mx_RightPanel_header">
                    <div className="mx_RightPanel_headerButtonGroup">
                        {headerButtons}
                    </div>
                </div>
                { panel }
                <div className="mx_RightPanel_footer">
                    { inviteGroup }
                </div>
            </aside>
        );
    }
});
