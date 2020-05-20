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
import dis from '../../dispatcher/dispatcher';
import RateLimitedFunc from '../../ratelimitedfunc';
import { showGroupInviteDialog, showGroupAddRoomDialog } from '../../GroupAddressPicker';
import GroupStore from '../../stores/GroupStore';
import SettingsStore from "../../settings/SettingsStore";
import {RIGHT_PANEL_PHASES, RIGHT_PANEL_PHASES_NO_ARGS} from "../../stores/RightPanelStorePhases";
import RightPanelStore from "../../stores/RightPanelStore";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import {Action} from "../../dispatcher/actions";

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
            verificationRequest: RightPanelStore.getSharedInstance().roomPanelPhaseParams.verificationRequest,
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

    // gets the current phase from the props and also maybe the store
    _getPhaseFromProps() {
        const rps = RightPanelStore.getSharedInstance();
        const userForPanel = this._getUserForPanel();
        if (this.props.groupId) {
            if (!RIGHT_PANEL_PHASES_NO_ARGS.includes(rps.groupPanelPhase)) {
                dis.dispatch({action: "set_right_panel_phase", phase: RIGHT_PANEL_PHASES.GroupMemberList});
                return RIGHT_PANEL_PHASES.GroupMemberList;
            }
            return rps.groupPanelPhase;
        } else if (userForPanel) {
            // XXX FIXME AAAAAARGH: What is going on with this class!? It takes some of its state
            // from its props and some from a store, except if the contents of the store changes
            // while it's mounted in which case it replaces all of its state with that of the store,
            // except it uses a dispatch instead of a normal store listener?
            // Unfortunately rewriting this would almost certainly break showing the right panel
            // in some of the many cases, and I don't have time to re-architect it and test all
            // the flows now, so adding yet another special case so if the store thinks there is
            // a verification going on for the member we're displaying, we show that, otherwise
            // we race if a verification is started while the panel isn't displayed because we're
            // not mounted in time to get the dispatch.
            // Until then, let this code serve as a warning from history.
            if (
                rps.roomPanelPhaseParams.member &&
                userForPanel.userId === rps.roomPanelPhaseParams.member.userId &&
                rps.roomPanelPhaseParams.verificationRequest
            ) {
                return rps.roomPanelPhase;
            }
            return RIGHT_PANEL_PHASES.RoomMemberInfo;
        } else {
            if (!RIGHT_PANEL_PHASES_NO_ARGS.includes(rps.roomPanelPhase)) {
                dis.dispatch({action: "set_right_panel_phase", phase: RIGHT_PANEL_PHASES.RoomMemberList});
                return RIGHT_PANEL_PHASES.RoomMemberList;
            }
            return rps.roomPanelPhase;
        }
    }

    componentDidMount() {
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

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps(newProps) { // eslint-disable-line camelcase
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
                verificationRequestPromise: payload.verificationRequestPromise,
            });
        }
    }

    render() {
        const MemberList = sdk.getComponent('rooms.MemberList');
        const MemberInfo = sdk.getComponent('rooms.MemberInfo');
        const UserInfo = sdk.getComponent('right_panel.UserInfo');
        const ThirdPartyMemberInfo = sdk.getComponent('rooms.ThirdPartyMemberInfo');
        const NotificationPanel = sdk.getComponent('structures.NotificationPanel');
        const FilePanel = sdk.getComponent('structures.FilePanel');

        const GroupMemberList = sdk.getComponent('groups.GroupMemberList');
        const GroupMemberInfo = sdk.getComponent('groups.GroupMemberInfo');
        const GroupRoomList = sdk.getComponent('groups.GroupRoomList');
        const GroupRoomInfo = sdk.getComponent('groups.GroupRoomInfo');

        let panel = <div />;

        switch (this.state.phase) {
            case RIGHT_PANEL_PHASES.RoomMemberList:
                if (this.props.roomId) {
                    panel = <MemberList roomId={this.props.roomId} key={this.props.roomId} />;
                }
                break;
            case RIGHT_PANEL_PHASES.GroupMemberList:
                if (this.props.groupId) {
                    panel = <GroupMemberList groupId={this.props.groupId} key={this.props.groupId} />;
                }
                break;
            case RIGHT_PANEL_PHASES.GroupRoomList:
                panel = <GroupRoomList groupId={this.props.groupId} key={this.props.groupId} />;
                break;
            case RIGHT_PANEL_PHASES.RoomMemberInfo:
            case RIGHT_PANEL_PHASES.EncryptionPanel:
                if (SettingsStore.getValue("feature_cross_signing")) {
                    const onClose = () => {
                        // XXX: There are three different ways of 'closing' this panel depending on what state
                        // things are in... this knows far more than it should do about the state of the rest
                        // of the app and is generally a bit silly.
                        if (this.props.user) {
                            // If we have a user prop then we're displaying a user from the 'user' page type
                            // in LoggedInView, so need to change the page type to close the panel (we switch
                            // to the home page which is not obviously the correct thing to do, but I'm not sure
                            // anything else is - we could hide the close button altogether?)
                            dis.dispatch({
                                action: "view_home_page",
                            });
                        } else {
                            // Otherwise we have got our user from RoomViewStore which means we're being shown
                            // within a room, so go back to the member panel if we were in the encryption panel,
                            // or the member list if we were in the member panel... phew.
                            dis.dispatch({
                                action: Action.ViewUser,
                                member: this.state.phase === RIGHT_PANEL_PHASES.EncryptionPanel ?
                                    this.state.member : null,
                            });
                        }
                    };
                    panel = <UserInfo
                        user={this.state.member}
                        roomId={this.props.roomId}
                        key={this.props.roomId || this.state.member.userId}
                        onClose={onClose}
                        phase={this.state.phase}
                        verificationRequest={this.state.verificationRequest}
                        verificationRequestPromise={this.state.verificationRequestPromise}
                    />;
                } else {
                    panel = <MemberInfo
                        member={this.state.member}
                        key={this.props.roomId || this.state.member.userId}
                    />;
                }
                break;
            case RIGHT_PANEL_PHASES.Room3pidMemberInfo:
                panel = <ThirdPartyMemberInfo event={this.state.event} key={this.props.roomId} />;
                break;
            case RIGHT_PANEL_PHASES.GroupMemberInfo:
                if (SettingsStore.getValue("feature_cross_signing")) {
                    const onClose = () => {
                        dis.dispatch({
                            action: Action.ViewUser,
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
                break;
            case RIGHT_PANEL_PHASES.GroupRoomInfo:
                panel = <GroupRoomInfo
                    groupRoomId={this.state.groupRoomId}
                    groupId={this.props.groupId}
                    key={this.state.groupRoomId} />;
                break;
            case RIGHT_PANEL_PHASES.NotificationPanel:
                panel = <NotificationPanel />;
                break;
            case RIGHT_PANEL_PHASES.FilePanel:
                panel = <FilePanel roomId={this.props.roomId} resizeNotifier={this.props.resizeNotifier} />;
                break;
        }

        const classes = classNames("mx_RightPanel", "mx_fadable", {
            "collapsed": this.props.collapsed,
            "mx_fadable_faded": this.props.disabled,
            "dark-panel": true,
        });

        return (
            <aside className={classes} id="mx_RightPanel">
                { panel }
            </aside>
        );
    }
}
