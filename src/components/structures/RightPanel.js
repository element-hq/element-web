/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd

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
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { _t } from '../../languageHandler';
import sdk from '../../index';
import dis from '../../dispatcher';
import { MatrixClient } from 'matrix-js-sdk';
import Analytics from '../../Analytics';
import RateLimitedFunc from '../../ratelimitedfunc';
import AccessibleButton from '../../components/views/elements/AccessibleButton';
import { showGroupInviteDialog, showGroupAddRoomDialog } from '../../GroupAddressPicker';
import GroupStore from '../../stores/GroupStore';

import { formatCount } from '../../utils/FormattingUtils';

class HeaderButton extends React.Component {
    constructor() {
        super();
        this.onClick = this.onClick.bind(this);
    }

    onClick(ev) {
        Analytics.trackEvent(...this.props.analytics);
        dis.dispatch({
            action: 'view_right_panel_phase',
            phase: this.props.clickPhase,
        });
    }

    render() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");

        const classes = classNames({
            mx_RightPanel_headerButton: true,
            mx_RightPanel_headerButton_highlight: this.props.isHighlighted,
        })
        // will probably use this later on for notifications, etc ...
        /* <div className="mx_RightPanel_headerButton_badge">
            { this.props.badge ? this.props.badge : <span>&nbsp;</span> }
        </div> */

        return <AccessibleButton
            aria-label={this.props.title}
            aria-expanded={this.props.isHighlighted}
            title={this.props.title}
            className={classes}
            onClick={this.onClick} >
                <TintableSvg src={this.props.iconSrc} width="20" height="20" />
            </AccessibleButton>;
    }
}

HeaderButton.propTypes = {
    // Whether this button is highlighted
    isHighlighted: PropTypes.bool.isRequired,
    // The phase to swap to when the button is clicked
    clickPhase: PropTypes.string.isRequired,
    // The source file of the icon to display
    iconSrc: PropTypes.string.isRequired,

    // The badge to display above the icon
    badge: PropTypes.node,
    // The parameters to track the click event
    analytics: PropTypes.arrayOf(PropTypes.string).isRequired,

    // Button title
    title: PropTypes.string.isRequired,
};

module.exports = React.createClass({
    displayName: 'RightPanel',

    propTypes: {
        // TODO: We're trying to move away from these being props, but we need to know
        // whether we should be displaying a room or group member list
        roomId: React.PropTypes.string, // if showing panels for a given room, this is set
        groupId: React.PropTypes.string, // if showing panels for a given group, this is set
        collapsed: React.PropTypes.bool, // currently unused property to request for a minimized view of the panel
    },

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    Phase: {
        RoomMemberList: 'RoomMemberList',
        GroupMemberList: 'GroupMemberList',
        GroupRoomList: 'GroupRoomList',
        GroupRoomInfo: 'GroupRoomInfo',
        FilePanel: 'FilePanel',
        NotificationPanel: 'NotificationPanel',
        RoomMemberInfo: 'RoomMemberInfo',
        GroupMemberInfo: 'GroupMemberInfo',
    },

    componentWillMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        const cli = this.context.matrixClient;
        cli.on("RoomState.members", this.onRoomStateMember);
        this._initGroupStore(this.props.groupId);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
        if (this.context.matrixClient) {
            this.context.matrixClient.removeListener("RoomState.members", this.onRoomStateMember);
        }
        this._unregisterGroupStore(this.props.groupId);
    },

    getInitialState: function() {
        return {
            phase: this.props.groupId ? this.Phase.GroupMemberList : this.Phase.RoomMemberList,
            isUserPrivilegedInGroup: null,
        };
    },

    componentWillReceiveProps(newProps) {
        if (newProps.groupId !== this.props.groupId) {
            this._unregisterGroupStore(this.props.groupId);
            this._initGroupStore(newProps.groupId);
        }
    },

    _initGroupStore(groupId) {
        if (!groupId) return;
        GroupStore.registerListener(groupId, this.onGroupStoreUpdated);
    },

    _unregisterGroupStore() {
        GroupStore.unregisterListener(this.onGroupStoreUpdated);
    },

    onGroupStoreUpdated: function() {
        this.setState({
            isUserPrivilegedInGroup: GroupStore.isUserPrivileged(this.props.groupId),
        });
    },

    onCollapseClick: function() {
        dis.dispatch({
            action: 'hide_right_panel',
        });
    },

    onInviteToGroupButtonClick: function() {
        showGroupInviteDialog(this.props.groupId).then(() => {
            this.setState({
                phase: this.Phase.GroupMemberList,
            });
        });
    },

    onAddRoomToGroupButtonClick: function() {
        showGroupAddRoomDialog(this.props.groupId).then(() => {
            this.forceUpdate();
        });
    },

    onRoomStateMember: function(ev, state, member) {
        if (member.roomId !== this.props.roomId) {
            return;
        }
        // redraw the badge on the membership list
        if (this.state.phase === this.Phase.RoomMemberList && member.roomId === this.props.roomId) {
            this._delayedUpdate();
        } else if (this.state.phase === this.Phase.RoomMemberInfo && member.roomId === this.props.roomId &&
                member.userId === this.state.member.userId) {
            // refresh the member info (e.g. new power level)
            this._delayedUpdate();
        }
    },

    _delayedUpdate: new RateLimitedFunc(function() {
        this.forceUpdate(); // eslint-disable-line babel/no-invalid-this
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
                        phase: this.Phase.RoomMemberList,
                    });
                } else if (this.props.groupId) {
                    this.setState({
                        phase: this.Phase.GroupMemberList,
                        member: payload.member,
                    });
                }
            }
        } else if (payload.action === "view_group") {
            this.setState({
                phase: this.Phase.GroupMemberList,
                member: null,
            });
        } else if (payload.action === "view_group_room") {
            this.setState({
                phase: this.Phase.GroupRoomInfo,
                groupRoomId: payload.groupRoomId,
            });
        } else if (payload.action === "view_group_room_list") {
            this.setState({
                phase: this.Phase.GroupRoomList,
            });
        } else if (payload.action === "view_group_member_list") {
            this.setState({
                phase: this.Phase.GroupMemberList,
            });
        } else if (payload.action === "view_group_user") {
            this.setState({
                phase: this.Phase.GroupMemberInfo,
                member: payload.member,
            });
        } else if (payload.action === "view_room") {
            this.setState({
                phase: this.Phase.RoomMemberList,
            });
        } else if (payload.action === "view_right_panel_phase") {
            this.setState({
                phase: payload.phase,
            });
        }
    },

    render: function() {
        const MemberList = sdk.getComponent('rooms.MemberList');
        const MemberInfo = sdk.getComponent('rooms.MemberInfo');
        const NotificationPanel = sdk.getComponent('structures.NotificationPanel');
        const FilePanel = sdk.getComponent('structures.FilePanel');

        const GroupMemberList = sdk.getComponent('groups.GroupMemberList');
        const GroupMemberInfo = sdk.getComponent('groups.GroupMemberInfo');
        const GroupRoomList = sdk.getComponent('groups.GroupRoomList');
        const GroupRoomInfo = sdk.getComponent('groups.GroupRoomInfo');

        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        let inviteGroup;

        let membersBadge;
        let membersTitle = _t('Members');

        const isPhaseGroup = [
            this.Phase.GroupMemberInfo,
            this.Phase.GroupMemberList,
        ].includes(this.state.phase);

        let headerButtons = [];
        if (this.props.roomId) {
            headerButtons = [
                <HeaderButton key="_membersButton" title={membersTitle} iconSrc="img/icons-people.svg"
                    isHighlighted={[this.Phase.RoomMemberList, this.Phase.RoomMemberInfo].includes(this.state.phase)}
                    clickPhase={this.Phase.RoomMemberList}
                    badge={membersBadge}
                    analytics={['Right Panel', 'Member List Button', 'click']}
                />,
                <HeaderButton key="_filesButton" title={_t('Files')} iconSrc="img/icons-files.svg"
                    isHighlighted={this.state.phase === this.Phase.FilePanel}
                    clickPhase={this.Phase.FilePanel}
                    analytics={['Right Panel', 'File List Button', 'click']}
                />,
                <HeaderButton key="_notifsButton" title={_t('Notifications')} iconSrc="img/icons-notifications.svg"
                    isHighlighted={this.state.phase === this.Phase.NotificationPanel}
                    clickPhase={this.Phase.NotificationPanel}
                    analytics={['Right Panel', 'Notification List Button', 'click']}
                />,
            ];
        } else if (this.props.groupId) {
            headerButtons = [
                <HeaderButton key="_groupMembersButton" title={_t('Members')} iconSrc="img/icons-people.svg"
                    isHighlighted={isPhaseGroup}
                    clickPhase={this.Phase.GroupMemberList}
                    analytics={['Right Panel', 'Group Member List Button', 'click']}
                />,
                <HeaderButton key="_roomsButton" title={_t('Rooms')} iconSrc="img/icons-room.svg"
                    isHighlighted={[this.Phase.GroupRoomList, this.Phase.GroupRoomInfo].includes(this.state.phase)}
                    clickPhase={this.Phase.GroupRoomList}
                    analytics={['Right Panel', 'Group Room List Button', 'click']}
                />,
            ];
        }

        if (this.props.roomId || this.props.groupId) {
            // Hiding the right panel hides it completely and relies on an 'expand' button
            // being put in the RoomHeader or GroupView header, so only show the minimise
            // button on these 2 screens or you won't be able to re-expand the panel.
            headerButtons.push(
                <AccessibleButton className="mx_RightPanel_headerButton mx_RightPanel_collapsebutton" key="_minimizeButton"
                    title={_t("Hide panel")} aria-label={_t("Hide panel")} onClick={this.onCollapseClick}
                >
                    <TintableSvg src="img/minimise.svg" width="10" height="16" alt="" />
                </AccessibleButton>,
            );
        }

        let panel = <div />;
        if (!this.props.collapsed) {
            if (this.props.roomId && this.state.phase === this.Phase.RoomMemberList) {
                panel = <MemberList roomId={this.props.roomId} key={this.props.roomId} />;
            } else if (this.props.groupId && this.state.phase === this.Phase.GroupMemberList) {
                panel = <GroupMemberList groupId={this.props.groupId} key={this.props.groupId} />;
            } else if (this.state.phase === this.Phase.GroupRoomList) {
                panel = <GroupRoomList groupId={this.props.groupId} key={this.props.groupId} />;
            } else if (this.state.phase === this.Phase.RoomMemberInfo) {
                panel = <MemberInfo member={this.state.member} key={this.props.roomId || this.state.member.userId} />;
            } else if (this.state.phase === this.Phase.GroupMemberInfo) {
                panel = <GroupMemberInfo
                    groupMember={this.state.member}
                    groupId={this.props.groupId}
                    key={this.state.member.user_id} />;
            } else if (this.state.phase === this.Phase.GroupRoomInfo) {
                panel = <GroupRoomInfo
                    groupRoomId={this.state.groupRoomId}
                    groupId={this.props.groupId}
                    key={this.state.groupRoomId} />;
            } else if (this.state.phase === this.Phase.NotificationPanel) {
                panel = <NotificationPanel />;
            } else if (this.state.phase === this.Phase.FilePanel) {
                panel = <FilePanel roomId={this.props.roomId} />;
            }
        }

        if (!panel) {
            panel = <div className="mx_RightPanel_blank" />;
        }

        if (this.props.groupId && this.state.isUserPrivilegedInGroup) {
            inviteGroup = isPhaseGroup ? (
                <AccessibleButton className="mx_RightPanel_invite" onClick={this.onInviteToGroupButtonClick}>
                    <div className="mx_RightPanel_icon" >
                        <TintableSvg src="img/icon-invite-people.svg" width="35" height="35" />
                    </div>
                    <div className="mx_RightPanel_message">{ _t('Invite to this community') }</div>
                </AccessibleButton>
            ) : (
                <AccessibleButton className="mx_RightPanel_invite" onClick={this.onAddRoomToGroupButtonClick}>
                    <div className="mx_RightPanel_icon" >
                        <TintableSvg src="img/icons-room-add.svg" width="35" height="35" />
                    </div>
                    <div className="mx_RightPanel_message">{ _t('Add rooms to this community') }</div>
                </AccessibleButton>
            );
        }

        const classes = classNames("mx_RightPanel", "mx_fadable", {
            "collapsed": this.props.collapsed,
            "mx_fadable_faded": this.props.disabled,
        });

        return (
            <aside className={classes}>
                <div className="mx_RightPanel_header">
                    <div className="mx_RightPanel_headerButtonGroup">
                        { headerButtons }
                    </div>
                </div>
                { panel }
            </aside>
        );
    },
});
