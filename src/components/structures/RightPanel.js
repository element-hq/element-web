/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015 - 2020 The Matrix.org Foundation C.I.C.

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
import {Room} from "matrix-js-sdk/src/models/room";

import * as sdk from '../../index';
import dis from '../../dispatcher/dispatcher';
import RateLimitedFunc from '../../ratelimitedfunc';
import { showGroupInviteDialog, showGroupAddRoomDialog } from '../../GroupAddressPicker';
import GroupStore from '../../stores/GroupStore';
import {
    RightPanelPhases,
    RIGHT_PANEL_PHASES_NO_ARGS,
    RIGHT_PANEL_SPACE_PHASES,
} from "../../stores/RightPanelStorePhases";
import RightPanelStore from "../../stores/RightPanelStore";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import {Action} from "../../dispatcher/actions";
import RoomSummaryCard from "../views/right_panel/RoomSummaryCard";
import WidgetCard from "../views/right_panel/WidgetCard";
import {replaceableComponent} from "../../utils/replaceableComponent";
import SettingsStore from "../../settings/SettingsStore";

@replaceableComponent("structures.RightPanel")
export default class RightPanel extends React.Component {
    static get propTypes() {
        return {
            room: PropTypes.instanceOf(Room), // if showing panels for a given room, this is set
            groupId: PropTypes.string, // if showing panels for a given group, this is set
            user: PropTypes.object, // used if we know the user ahead of opening the panel
        };
    }

    static contextType = MatrixClientContext;

    constructor(props, context) {
        super(props, context);
        this.state = {
            ...RightPanelStore.getSharedInstance().roomPanelPhaseParams,
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

    // gets the current phase from the props and also maybe the store
    _getPhaseFromProps() {
        const rps = RightPanelStore.getSharedInstance();
        const userForPanel = this._getUserForPanel();
        if (this.props.groupId) {
            if (!RIGHT_PANEL_PHASES_NO_ARGS.includes(rps.groupPanelPhase)) {
                dis.dispatch({action: Action.SetRightPanelPhase, phase: RightPanelPhases.GroupMemberList});
                return RightPanelPhases.GroupMemberList;
            }
            return rps.groupPanelPhase;
        } else if (SettingsStore.getValue("feature_spaces") && this.props.room?.isSpaceRoom()
            && !RIGHT_PANEL_SPACE_PHASES.includes(rps.roomPanelPhase)
        ) {
            return RightPanelPhases.SpaceMemberList;
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
            return RightPanelPhases.RoomMemberInfo;
        }
        return rps.roomPanelPhase;
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
                phase: RightPanelPhases.GroupMemberList,
            });
        });
    }

    onAddRoomToGroupButtonClick() {
        showGroupAddRoomDialog(this.props.groupId).then(() => {
            this.forceUpdate();
        });
    }

    onRoomStateMember(ev, state, member) {
        if (!this.props.room || member.roomId !== this.props.room.roomId) {
            return;
        }
        // redraw the badge on the membership list
        if (this.state.phase === RightPanelPhases.RoomMemberList && member.roomId === this.props.room.roomId) {
            this._delayedUpdate();
        } else if (this.state.phase === RightPanelPhases.RoomMemberInfo && member.roomId === this.props.room.roomId &&
                member.userId === this.state.member.userId) {
            // refresh the member info (e.g. new power level)
            this._delayedUpdate();
        }
    }

    onAction(payload) {
        if (payload.action === Action.AfterRightPanelPhaseChange) {
            this.setState({
                phase: payload.phase,
                groupRoomId: payload.groupRoomId,
                groupId: payload.groupId,
                member: payload.member,
                event: payload.event,
                verificationRequest: payload.verificationRequest,
                verificationRequestPromise: payload.verificationRequestPromise,
                widgetId: payload.widgetId,
                space: payload.space,
            });
        }
    }

    onClose = () => {
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
        } else if (
            this.state.phase === RightPanelPhases.EncryptionPanel &&
            this.state.verificationRequest && this.state.verificationRequest.pending
        ) {
            // When the user clicks close on the encryption panel cancel the pending request first if any
            this.state.verificationRequest.cancel();
        } else {
            // the RightPanelStore has no way of knowing which mode room/group it is in, so we handle closing here
            dis.dispatch({
                action: Action.ToggleRightPanel,
                type: this.props.groupId ? "group" : "room",
            });
        }
    };

    render() {
        const MemberList = sdk.getComponent('rooms.MemberList');
        const UserInfo = sdk.getComponent('right_panel.UserInfo');
        const ThirdPartyMemberInfo = sdk.getComponent('rooms.ThirdPartyMemberInfo');
        const NotificationPanel = sdk.getComponent('structures.NotificationPanel');
        const FilePanel = sdk.getComponent('structures.FilePanel');

        const GroupMemberList = sdk.getComponent('groups.GroupMemberList');
        const GroupRoomList = sdk.getComponent('groups.GroupRoomList');
        const GroupRoomInfo = sdk.getComponent('groups.GroupRoomInfo');

        let panel = <div />;
        const roomId = this.props.room ? this.props.room.roomId : undefined;

        switch (this.state.phase) {
            case RightPanelPhases.RoomMemberList:
                if (roomId) {
                    panel = <MemberList roomId={roomId} key={roomId} onClose={this.onClose} />;
                }
                break;
            case RightPanelPhases.SpaceMemberList:
                panel = <MemberList
                    roomId={this.state.space ? this.state.space.roomId : roomId}
                    key={this.state.space ? this.state.space.roomId : roomId}
                    onClose={this.onClose}
                />;
                break;

            case RightPanelPhases.GroupMemberList:
                if (this.props.groupId) {
                    panel = <GroupMemberList groupId={this.props.groupId} key={this.props.groupId} />;
                }
                break;

            case RightPanelPhases.GroupRoomList:
                panel = <GroupRoomList groupId={this.props.groupId} key={this.props.groupId} />;
                break;

            case RightPanelPhases.RoomMemberInfo:
            case RightPanelPhases.SpaceMemberInfo:
            case RightPanelPhases.EncryptionPanel:
                panel = <UserInfo
                    user={this.state.member}
                    room={this.state.phase === RightPanelPhases.SpaceMemberInfo ? this.state.space : this.props.room}
                    key={roomId || this.state.member.userId}
                    onClose={this.onClose}
                    phase={this.state.phase}
                    verificationRequest={this.state.verificationRequest}
                    verificationRequestPromise={this.state.verificationRequestPromise}
                />;
                break;

            case RightPanelPhases.Room3pidMemberInfo:
            case RightPanelPhases.Space3pidMemberInfo:
                panel = <ThirdPartyMemberInfo event={this.state.event} key={roomId} />;
                break;

            case RightPanelPhases.GroupMemberInfo:
                panel = <UserInfo
                    user={this.state.member}
                    groupId={this.props.groupId}
                    key={this.state.member.userId}
                    onClose={this.onClose} />;
                break;

            case RightPanelPhases.GroupRoomInfo:
                panel = <GroupRoomInfo
                    groupRoomId={this.state.groupRoomId}
                    groupId={this.props.groupId}
                    key={this.state.groupRoomId} />;
                break;

            case RightPanelPhases.NotificationPanel:
                panel = <NotificationPanel onClose={this.onClose} />;
                break;

            case RightPanelPhases.FilePanel:
                panel = <FilePanel roomId={roomId} resizeNotifier={this.props.resizeNotifier} onClose={this.onClose} />;
                break;

            case RightPanelPhases.RoomSummary:
                panel = <RoomSummaryCard room={this.props.room} onClose={this.onClose} />;
                break;

            case RightPanelPhases.Widget:
                panel = <WidgetCard room={this.props.room} widgetId={this.state.widgetId} onClose={this.onClose} />;
                break;
        }

        return (
            <aside className="mx_RightPanel dark-panel" id="mx_RightPanel">
                { panel }
            </aside>
        );
    }
}
