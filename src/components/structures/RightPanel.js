/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import sdk from '../../index';
import dis from '../../dispatcher';
import { MatrixClient } from 'matrix-js-sdk';
import RateLimitedFunc from '../../ratelimitedfunc';
import { showGroupInviteDialog, showGroupAddRoomDialog } from '../../GroupAddressPicker';
import GroupStore from '../../stores/GroupStore';

export default class RightPanel extends React.Component {
    static get propTypes() {
        return {
            roomId: PropTypes.string, // if showing panels for a given room, this is set
            groupId: PropTypes.string, // if showing panels for a given group, this is set
            user: PropTypes.object,
        };
    }

    static get contextTypes() {
        return {
            matrixClient: PropTypes.instanceOf(MatrixClient),
        };
    }

    static Phase = Object.freeze({
        RoomMemberList: 'RoomMemberList',
        GroupMemberList: 'GroupMemberList',
        GroupRoomList: 'GroupRoomList',
        GroupRoomInfo: 'GroupRoomInfo',
        FilePanel: 'FilePanel',
        NotificationPanel: 'NotificationPanel',
        RoomMemberInfo: 'RoomMemberInfo',
        Room3pidMemberInfo: 'Room3pidMemberInfo',
        GroupMemberInfo: 'GroupMemberInfo',
    });

    constructor(props, context) {
        super(props, context);
        this.state = {
            phase: this._getPhaseFromProps(),
            isUserPrivilegedInGroup: null,
        };
        this.onAction = this.onAction.bind(this);
        this.onRoomStateMember = this.onRoomStateMember.bind(this);
        this.onGroupStoreUpdated = this.onGroupStoreUpdated.bind(this);
        this.onInviteToGroupButtonClick = this.onInviteToGroupButtonClick.bind(this);
        this.onAddRoomToGroupButtonClick = this.onAddRoomToGroupButtonClick.bind(this);

        this._delayedUpdate = new RateLimitedFunc(() => {
            this.forceUpdate();
        }, 500);
    }

    _getPhaseFromProps() {
        if (this.props.groupId) {
            return RightPanel.Phase.GroupMemberList;
        } else if (this.props.user) {
            return RightPanel.Phase.RoomMemberInfo;
        } else {
            return RightPanel.Phase.RoomMemberList;
        }
    }

    componentWillMount() {
        this.dispatcherRef = dis.register(this.onAction);
        const cli = this.context.matrixClient;
        cli.on("RoomState.members", this.onRoomStateMember);
        this._initGroupStore(this.props.groupId);
        if (this.props.user) {
            this.setState({member: this.props.user});
        }
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
        if (this.context.matrixClient) {
            this.context.matrixClient.removeListener("RoomState.members", this.onRoomStateMember);
        }
        this._unregisterGroupStore(this.props.groupId);
    }

    componentWillReceiveProps(newProps) {
        if (newProps.groupId !== this.props.groupId) {
            this._unregisterGroupStore(this.props.groupId);
            this._initGroupStore(newProps.groupId);
        }
    }

    _initGroupStore(groupId) {
        if (!groupId) return;
        GroupStore.registerListener(groupId, this.onGroupStoreUpdated);
    }

    _unregisterGroupStore() {
        GroupStore.unregisterListener(this.onGroupStoreUpdated);
    }

    onGroupStoreUpdated() {
        this.setState({
            isUserPrivilegedInGroup: GroupStore.isUserPrivileged(this.props.groupId),
        });
    }

    onInviteToGroupButtonClick() {
        showGroupInviteDialog(this.props.groupId).then(() => {
            this.setState({
                phase: RightPanel.Phase.GroupMemberList,
            });
        });
    }

    onAddRoomToGroupButtonClick() {
        showGroupAddRoomDialog(this.props.groupId).then(() => {
            this.forceUpdate();
        });
    }

    onRoomStateMember(ev, state, member) {
        if (member.roomId !== this.props.roomId) {
            return;
        }
        // redraw the badge on the membership list
        if (this.state.phase === RightPanel.Phase.RoomMemberList && member.roomId === this.props.roomId) {
            this._delayedUpdate();
        } else if (this.state.phase === RightPanel.Phase.RoomMemberInfo && member.roomId === this.props.roomId &&
                member.userId === this.state.member.userId) {
            // refresh the member info (e.g. new power level)
            this._delayedUpdate();
        }
    }

    onAction(payload) {
        if (payload.action === "view_right_panel_phase") {
            this.setState({
                phase: payload.phase,
                groupRoomId: payload.groupRoomId,
                groupId: payload.groupId,
                member: payload.member,
                event: payload.event,
            });
        }
    }

    render() {
        const MemberList = sdk.getComponent('rooms.MemberList');
        const MemberInfo = sdk.getComponent('rooms.MemberInfo');
        const ThirdPartyMemberInfo = sdk.getComponent('rooms.ThirdPartyMemberInfo');
        const NotificationPanel = sdk.getComponent('structures.NotificationPanel');
        const FilePanel = sdk.getComponent('structures.FilePanel');

        const GroupMemberList = sdk.getComponent('groups.GroupMemberList');
        const GroupMemberInfo = sdk.getComponent('groups.GroupMemberInfo');
        const GroupRoomList = sdk.getComponent('groups.GroupRoomList');
        const GroupRoomInfo = sdk.getComponent('groups.GroupRoomInfo');

        let panel = <div />;

        if (this.props.roomId && this.state.phase === RightPanel.Phase.RoomMemberList) {
            panel = <MemberList roomId={this.props.roomId} key={this.props.roomId} />;
        } else if (this.props.groupId && this.state.phase === RightPanel.Phase.GroupMemberList) {
            panel = <GroupMemberList groupId={this.props.groupId} key={this.props.groupId} />;
        } else if (this.state.phase === RightPanel.Phase.GroupRoomList) {
            panel = <GroupRoomList groupId={this.props.groupId} key={this.props.groupId} />;
        } else if (this.state.phase === RightPanel.Phase.RoomMemberInfo) {
            panel = <MemberInfo member={this.state.member} key={this.props.roomId || this.state.member.userId} />;
        } else if (this.state.phase === RightPanel.Phase.Room3pidMemberInfo) {
            panel = <ThirdPartyMemberInfo event={this.state.event} key={this.props.roomId} />;
        } else if (this.state.phase === RightPanel.Phase.GroupMemberInfo) {
            panel = <GroupMemberInfo
                groupMember={this.state.member}
                groupId={this.props.groupId}
                key={this.state.member.user_id} />;
        } else if (this.state.phase === RightPanel.Phase.GroupRoomInfo) {
            panel = <GroupRoomInfo
                groupRoomId={this.state.groupRoomId}
                groupId={this.props.groupId}
                key={this.state.groupRoomId} />;
        } else if (this.state.phase === RightPanel.Phase.NotificationPanel) {
            panel = <NotificationPanel />;
        } else if (this.state.phase === RightPanel.Phase.FilePanel) {
            panel = <FilePanel roomId={this.props.roomId} resizeNotifier={this.props.resizeNotifier} />;
        }

        const classes = classNames("mx_RightPanel", "mx_fadable", {
            "collapsed": this.props.collapsed,
            "mx_fadable_faded": this.props.disabled,
            "dark-panel": true,
        });

        return (
            <aside className={classes}>
                { panel }
            </aside>
        );
    }
}
