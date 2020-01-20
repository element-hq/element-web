/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017, 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import * as sdk from '../../index';
import dis from '../../dispatcher';
import RateLimitedFunc from '../../ratelimitedfunc';
import { showGroupInviteDialog, showGroupAddRoomDialog } from '../../GroupAddressPicker';
import GroupStore from '../../stores/GroupStore';
import SettingsStore from "../../settings/SettingsStore";
import {RIGHT_PANEL_PHASES, RIGHT_PANEL_PHASES_NO_ARGS} from "../../stores/RightPanelStorePhases";
import RightPanelStore from "../../stores/RightPanelStore";
import MatrixClientContext from "../../contexts/MatrixClientContext";

export default class RightPanel extends React.Component {
    static get propTypes() {
        return {
            roomId: PropTypes.string, // if showing panels for a given room, this is set
            groupId: PropTypes.string, // if showing panels for a given group, this is set
            user: PropTypes.object, // used if we know the user ahead of opening the panel
        };
    }

    static contextType = MatrixClientContext;

    constructor(props) {
        super(props);
        this.state = {
            phase: this._getPhaseFromProps(),
            isUserPrivilegedInGroup: null,
            member: this._getUserForPanel(),
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

    // Helper function to split out the logic for _getPhaseFromProps() and the constructor
    // as both are called at the same time in the constructor.
    _getUserForPanel() {
        if (this.state && this.state.member) return this.state.member;
        const lastParams = RightPanelStore.getSharedInstance().roomPanelPhaseParams;
        return this.props.user || lastParams['member'];
    }

    _getPhaseFromProps() {
        const rps = RightPanelStore.getSharedInstance();
        if (this.props.groupId) {
            if (!RIGHT_PANEL_PHASES_NO_ARGS.includes(rps.groupPanelPhase)) {
                dis.dispatch({action: "set_right_panel_phase", phase: RIGHT_PANEL_PHASES.GroupMemberList});
                return RIGHT_PANEL_PHASES.GroupMemberList;
            }
            return rps.groupPanelPhase;
        } else if (this._getUserForPanel()) {
            return RIGHT_PANEL_PHASES.RoomMemberInfo;
        } else {
            if (!RIGHT_PANEL_PHASES_NO_ARGS.includes(rps.roomPanelPhase)) {
                dis.dispatch({action: "set_right_panel_phase", phase: RIGHT_PANEL_PHASES.RoomMemberList});
                return RIGHT_PANEL_PHASES.RoomMemberList;
            }
            return rps.roomPanelPhase;
        }
    }

    componentWillMount() {
        this.dispatcherRef = dis.register(this.onAction);
        const cli = this.context;
        cli.on("RoomState.members", this.onRoomStateMember);
        this._initGroupStore(this.props.groupId);
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
        if (this.context) {
            this.context.removeListener("RoomState.members", this.onRoomStateMember);
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
                phase: RIGHT_PANEL_PHASES.GroupMemberList,
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
        if (this.state.phase === RIGHT_PANEL_PHASES.RoomMemberList && member.roomId === this.props.roomId) {
            this._delayedUpdate();
        } else if (this.state.phase === RIGHT_PANEL_PHASES.RoomMemberInfo && member.roomId === this.props.roomId &&
                member.userId === this.state.member.userId) {
            // refresh the member info (e.g. new power level)
            this._delayedUpdate();
        }
    }

    onAction(payload) {
        if (payload.action === "after_right_panel_phase_change") {
            this.setState({
                phase: payload.phase,
                groupRoomId: payload.groupRoomId,
                groupId: payload.groupId,
                member: payload.member,
                event: payload.event,
                verificationRequest: payload.verificationRequest,
            });
        }
    }

    render() {
        const MemberList = sdk.getComponent('rooms.MemberList');
        const MemberInfo = sdk.getComponent('rooms.MemberInfo');
        const UserInfo = sdk.getComponent('right_panel.UserInfo');
        const EncryptionPanel = sdk.getComponent('right_panel.EncryptionPanel');
        const ThirdPartyMemberInfo = sdk.getComponent('rooms.ThirdPartyMemberInfo');
        const NotificationPanel = sdk.getComponent('structures.NotificationPanel');
        const FilePanel = sdk.getComponent('structures.FilePanel');

        const GroupMemberList = sdk.getComponent('groups.GroupMemberList');
        const GroupMemberInfo = sdk.getComponent('groups.GroupMemberInfo');
        const GroupRoomList = sdk.getComponent('groups.GroupRoomList');
        const GroupRoomInfo = sdk.getComponent('groups.GroupRoomInfo');

        let panel = <div />;

        if (this.props.roomId && this.state.phase === RIGHT_PANEL_PHASES.RoomMemberList) {
            panel = <MemberList roomId={this.props.roomId} key={this.props.roomId} />;
        } else if (this.props.groupId && this.state.phase === RIGHT_PANEL_PHASES.GroupMemberList) {
            panel = <GroupMemberList groupId={this.props.groupId} key={this.props.groupId} />;
        } else if (this.state.phase === RIGHT_PANEL_PHASES.GroupRoomList) {
            panel = <GroupRoomList groupId={this.props.groupId} key={this.props.groupId} />;
        } else if (this.state.phase === RIGHT_PANEL_PHASES.RoomMemberInfo) {
            if (SettingsStore.isFeatureEnabled("feature_cross_signing")) {
                const onClose = () => {
                    dis.dispatch({
                        action: "view_user",
                        member: null,
                    });
                };
                panel = <UserInfo
                    user={this.state.member}
                    roomId={this.props.roomId}
                    key={this.props.roomId || this.state.member.userId}
                    onClose={onClose}
                />;
            } else {
                panel = <MemberInfo member={this.state.member} key={this.props.roomId || this.state.member.userId} />;
            }
        } else if (this.state.phase === RIGHT_PANEL_PHASES.Room3pidMemberInfo) {
            panel = <ThirdPartyMemberInfo event={this.state.event} key={this.props.roomId} />;
        } else if (this.state.phase === RIGHT_PANEL_PHASES.GroupMemberInfo) {
            if (SettingsStore.isFeatureEnabled("feature_cross_signing")) {
                const onClose = () => {
                    dis.dispatch({
                        action: "view_user",
                        member: null,
                    });
                };
                panel = <UserInfo
                    user={this.state.member}
                    groupId={this.props.groupId}
                    key={this.state.member.userId}
                    onClose={onClose} />;
            } else {
                panel = (
                    <GroupMemberInfo
                        groupMember={this.state.member}
                        groupId={this.props.groupId}
                        key={this.state.member.user_id}
                    />
                );
            }
        } else if (this.state.phase === RIGHT_PANEL_PHASES.GroupRoomInfo) {
            panel = <GroupRoomInfo
                groupRoomId={this.state.groupRoomId}
                groupId={this.props.groupId}
                key={this.state.groupRoomId} />;
        } else if (this.state.phase === RIGHT_PANEL_PHASES.NotificationPanel) {
            panel = <NotificationPanel />;
        } else if (this.state.phase === RIGHT_PANEL_PHASES.FilePanel) {
            panel = <FilePanel roomId={this.props.roomId} resizeNotifier={this.props.resizeNotifier} />;
        } else if (this.state.phase === RIGHT_PANEL_PHASES.EncryptionPanel) {
            panel = <EncryptionPanel member={this.state.member} verificationRequest={this.state.verificationRequest} />;
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
