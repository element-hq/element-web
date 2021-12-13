/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

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
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomState } from "matrix-js-sdk/src/models/room-state";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { throttle } from 'lodash';

import dis from '../../dispatcher/dispatcher';
import GroupStore from '../../stores/GroupStore';
import {
    RIGHT_PANEL_PHASES_NO_ARGS,
    RIGHT_PANEL_SPACE_PHASES,
    RightPanelPhases,
} from "../../stores/RightPanelStorePhases";
import RightPanelStore from "../../stores/RightPanelStore";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { Action } from "../../dispatcher/actions";
import RoomSummaryCard from "../views/right_panel/RoomSummaryCard";
import WidgetCard from "../views/right_panel/WidgetCard";
import { replaceableComponent } from "../../utils/replaceableComponent";
import SettingsStore from "../../settings/SettingsStore";
import { ActionPayload } from "../../dispatcher/payloads";
import MemberList from "../views/rooms/MemberList";
import GroupMemberList from "../views/groups/GroupMemberList";
import GroupRoomList from "../views/groups/GroupRoomList";
import GroupRoomInfo from "../views/groups/GroupRoomInfo";
import UserInfo from "../views/right_panel/UserInfo";
import ThirdPartyMemberInfo from "../views/rooms/ThirdPartyMemberInfo";
import FilePanel from "./FilePanel";
import ThreadView from "./ThreadView";
import ThreadPanel from "./ThreadPanel";
import NotificationPanel from "./NotificationPanel";
import ResizeNotifier from "../../utils/ResizeNotifier";
import PinnedMessagesCard from "../views/right_panel/PinnedMessagesCard";
import SpaceStore from "../../stores/spaces/SpaceStore";
import { RoomPermalinkCreator } from '../../utils/permalinks/Permalinks';
import { E2EStatus } from '../../utils/ShieldUtils';
import { dispatchShowThreadsPanelEvent } from '../../dispatcher/dispatch-actions/threads';
import TimelineCard from '../views/right_panel/TimelineCard';

interface IProps {
    room?: Room; // if showing panels for a given room, this is set
    groupId?: string; // if showing panels for a given group, this is set
    member?: RoomMember; // used if we know the room member ahead of opening the panel
    resizeNotifier: ResizeNotifier;
    permalinkCreator?: RoomPermalinkCreator;
    e2eStatus?: E2EStatus;
}

interface IState {
    phase: RightPanelPhases;
    isUserPrivilegedInGroup?: boolean;
    member?: RoomMember;
    verificationRequest?: VerificationRequest;
    verificationRequestPromise?: Promise<VerificationRequest>;
    space?: Room;
    widgetId?: string;
    groupRoomId?: string;
    groupId?: string;
    event: MatrixEvent;
    initialEvent?: MatrixEvent;
    initialEventHighlighted?: boolean;
    searchQuery: string;
}

@replaceableComponent("structures.RightPanel")
export default class RightPanel extends React.Component<IProps, IState> {
    static contextType = MatrixClientContext;

    private dispatcherRef: string;

    constructor(props, context) {
        super(props, context);
        this.state = {
            ...RightPanelStore.getSharedInstance().roomPanelPhaseParams,
            phase: this.getPhaseFromProps(),
            isUserPrivilegedInGroup: null,
            member: this.getUserForPanel(),
            searchQuery: "",
        };
    }

    private readonly delayedUpdate = throttle((): void => {
        this.forceUpdate();
    }, 500, { leading: true, trailing: true });

    // Helper function to split out the logic for getPhaseFromProps() and the constructor
    // as both are called at the same time in the constructor.
    private getUserForPanel(): RoomMember {
        if (this.state && this.state.member) return this.state.member;
        const lastParams = RightPanelStore.getSharedInstance().roomPanelPhaseParams;
        return this.props.member || lastParams['member'];
    }

    // gets the current phase from the props and also maybe the store
    private getPhaseFromProps() {
        const rps = RightPanelStore.getSharedInstance();
        const userForPanel = this.getUserForPanel();
        if (this.props.groupId) {
            if (!RIGHT_PANEL_PHASES_NO_ARGS.includes(rps.groupPanelPhase)) {
                dis.dispatch({ action: Action.SetRightPanelPhase, phase: RightPanelPhases.GroupMemberList });
                return RightPanelPhases.GroupMemberList;
            }
            return rps.groupPanelPhase;
        } else if (SpaceStore.spacesEnabled && this.props.room?.isSpaceRoom()
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

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
        const cli = this.context;
        cli.on("RoomState.members", this.onRoomStateMember);
        this.initGroupStore(this.props.groupId);
    }

    public componentWillUnmount(): void {
        dis.unregister(this.dispatcherRef);
        if (this.context) {
            this.context.removeListener("RoomState.members", this.onRoomStateMember);
        }
        this.unregisterGroupStore();
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    public UNSAFE_componentWillReceiveProps(newProps: IProps): void { // eslint-disable-line
        if (newProps.groupId !== this.props.groupId) {
            this.unregisterGroupStore();
            this.initGroupStore(newProps.groupId);
        }
    }

    private initGroupStore(groupId: string) {
        if (!groupId) return;
        GroupStore.registerListener(groupId, this.onGroupStoreUpdated);
    }

    private unregisterGroupStore() {
        GroupStore.unregisterListener(this.onGroupStoreUpdated);
    }

    private onGroupStoreUpdated = () => {
        this.setState({
            isUserPrivilegedInGroup: GroupStore.isUserPrivileged(this.props.groupId),
        });
    };

    private onRoomStateMember = (ev: MatrixEvent, state: RoomState, member: RoomMember) => {
        if (!this.props.room || member.roomId !== this.props.room.roomId) {
            return;
        }
        // redraw the badge on the membership list
        if (this.state.phase === RightPanelPhases.RoomMemberList && member.roomId === this.props.room.roomId) {
            this.delayedUpdate();
        } else if (this.state.phase === RightPanelPhases.RoomMemberInfo && member.roomId === this.props.room.roomId &&
                member.userId === this.state.member.userId) {
            // refresh the member info (e.g. new power level)
            this.delayedUpdate();
        }
    };

    private onAction = (payload: ActionPayload) => {
        const isChangingRoom = payload.action === Action.ViewRoom && payload.room_id !== this.props.room.roomId;
        const isViewingThread = this.state.phase === RightPanelPhases.ThreadView;
        if (isChangingRoom && isViewingThread) {
            dispatchShowThreadsPanelEvent();
        }

        if (payload.action === Action.AfterRightPanelPhaseChange) {
            this.setState({
                phase: payload.phase,
                groupRoomId: payload.groupRoomId,
                groupId: payload.groupId,
                member: payload.member,
                event: payload.event,
                initialEvent: payload.initialEvent,
                initialEventHighlighted: payload.highlighted,
                verificationRequest: payload.verificationRequest,
                verificationRequestPromise: payload.verificationRequestPromise,
                widgetId: payload.widgetId,
                space: payload.space,
            });
        }
    };

    private onClose = () => {
        // XXX: There are three different ways of 'closing' this panel depending on what state
        // things are in... this knows far more than it should do about the state of the rest
        // of the app and is generally a bit silly.
        if (this.props.member) {
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

    private onSearchQueryChanged = (searchQuery: string): void => {
        this.setState({ searchQuery });
    };

    public render(): JSX.Element {
        let panel = <div />;
        const roomId = this.props.room ? this.props.room.roomId : undefined;

        switch (this.state.phase) {
            case RightPanelPhases.RoomMemberList:
                if (roomId) {
                    panel = <MemberList
                        roomId={roomId}
                        key={roomId}
                        onClose={this.onClose}
                        searchQuery={this.state.searchQuery}
                        onSearchQueryChanged={this.onSearchQueryChanged}
                    />;
                }
                break;
            case RightPanelPhases.SpaceMemberList:
                panel = <MemberList
                    roomId={this.state.space ? this.state.space.roomId : roomId}
                    key={this.state.space ? this.state.space.roomId : roomId}
                    onClose={this.onClose}
                    searchQuery={this.state.searchQuery}
                    onSearchQueryChanged={this.onSearchQueryChanged}
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
                    room={this.context.getRoom(this.state.member.roomId) ?? this.props.room}
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
                    phase={this.state.phase}
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

            case RightPanelPhases.PinnedMessages:
                if (SettingsStore.getValue("feature_pinning")) {
                    panel = <PinnedMessagesCard room={this.props.room} onClose={this.onClose} />;
                }
                break;
            case RightPanelPhases.Timeline:
                if (!SettingsStore.getValue("feature_maximised_widgets")) break;
                panel = <TimelineCard
                    classNames="mx_ThreadPanel mx_TimelineCard"
                    room={this.props.room}
                    timelineSet={this.props.room.getUnfilteredTimelineSet()}
                    resizeNotifier={this.props.resizeNotifier}
                    onClose={this.onClose}
                    permalinkCreator={this.props.permalinkCreator}
                    e2eStatus={this.props.e2eStatus}
                />;
                break;
            case RightPanelPhases.FilePanel:
                panel = <FilePanel roomId={roomId} resizeNotifier={this.props.resizeNotifier} onClose={this.onClose} />;
                break;

            case RightPanelPhases.ThreadView:
                panel = <ThreadView
                    room={this.props.room}
                    resizeNotifier={this.props.resizeNotifier}
                    onClose={this.onClose}
                    mxEvent={this.state.event}
                    initialEvent={this.state.initialEvent}
                    initialEventHighlighted={this.state.initialEventHighlighted}
                    permalinkCreator={this.props.permalinkCreator}
                    e2eStatus={this.props.e2eStatus} />;
                break;

            case RightPanelPhases.ThreadPanel:
                panel = <ThreadPanel
                    roomId={roomId}
                    resizeNotifier={this.props.resizeNotifier}
                    onClose={this.onClose}
                    permalinkCreator={this.props.permalinkCreator}
                />;
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
