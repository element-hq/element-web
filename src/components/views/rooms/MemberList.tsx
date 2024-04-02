/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017, 2018 New Vector Ltd
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

import React from "react";
import {
    MatrixEvent,
    Room,
    RoomEvent,
    RoomMember,
    RoomMemberEvent,
    RoomState,
    RoomStateEvent,
    User,
    UserEvent,
    EventType,
    ClientEvent,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { throttle } from "lodash";
import { Button, Tooltip } from "@vector-im/compound-web";
import { Icon as UserAddIcon } from "@vector-im/compound-design-tokens/icons/user-add-solid.svg";

import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { isValid3pidInvite } from "../../../RoomInvite";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import BaseCard from "../right_panel/BaseCard";
import TruncatedList from "../elements/TruncatedList";
import Spinner from "../elements/Spinner";
import SearchBox from "../../structures/SearchBox";
import { ButtonEvent } from "../elements/AccessibleButton";
import EntityTile from "./EntityTile";
import MemberTile from "./MemberTile";
import BaseAvatar from "../avatars/BaseAvatar";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import PosthogTrackers from "../../../PosthogTrackers";
import { SDKContext } from "../../../contexts/SDKContext";
import { canInviteTo } from "../../../utils/room/canInviteTo";
import { inviteToRoom } from "../../../utils/room/inviteToRoom";
import { Action } from "../../../dispatcher/actions";
import { SpaceScopeHeader } from "./SpaceScopeHeader";

const INITIAL_LOAD_NUM_MEMBERS = 30;
const INITIAL_LOAD_NUM_INVITED = 5;
const SHOW_MORE_INCREMENT = 100;

interface IProps {
    roomId: string;
    searchQuery: string;
    onClose(): void;
    onSearchQueryChanged: (query: string) => void;
}

interface IState {
    loading: boolean;
    filteredJoinedMembers: Array<RoomMember>;
    filteredInvitedMembers: Array<RoomMember | MatrixEvent>;
    canInvite: boolean;
    truncateAtJoined: number;
    truncateAtInvited: number;
}

export default class MemberList extends React.Component<IProps, IState> {
    private readonly showPresence: boolean;
    private mounted = false;

    public static contextType = SDKContext;
    public context!: React.ContextType<typeof SDKContext>;
    private tiles: Map<string, MemberTile> = new Map();

    public constructor(props: IProps, context: React.ContextType<typeof SDKContext>) {
        super(props);
        this.state = this.getMembersState([], []);
        this.showPresence = context?.memberListStore.isPresenceEnabled() ?? true;
        this.mounted = true;
        this.listenForMembersChanges();
    }

    private listenForMembersChanges(): void {
        const cli = MatrixClientPeg.safeGet();
        cli.on(RoomStateEvent.Update, this.onRoomStateUpdate);
        cli.on(RoomMemberEvent.Name, this.onRoomMemberName);
        cli.on(RoomStateEvent.Events, this.onRoomStateEvent);
        // We listen for changes to the lastPresenceTs which is essentially
        // listening for all presence events (we display most of not all of
        // the information contained in presence events).
        cli.on(UserEvent.LastPresenceTs, this.onUserPresenceChange);
        cli.on(UserEvent.Presence, this.onUserPresenceChange);
        cli.on(UserEvent.CurrentlyActive, this.onUserPresenceChange);
        cli.on(ClientEvent.Room, this.onRoom); // invites & joining after peek
        cli.on(RoomEvent.MyMembership, this.onMyMembership);
    }

    public componentDidMount(): void {
        this.updateListNow(true);
    }

    public componentWillUnmount(): void {
        this.mounted = false;
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener(RoomStateEvent.Update, this.onRoomStateUpdate);
            cli.removeListener(RoomMemberEvent.Name, this.onRoomMemberName);
            cli.removeListener(RoomEvent.MyMembership, this.onMyMembership);
            cli.removeListener(RoomStateEvent.Events, this.onRoomStateEvent);
            cli.removeListener(ClientEvent.Room, this.onRoom);
            cli.removeListener(UserEvent.LastPresenceTs, this.onUserPresenceChange);
            cli.removeListener(UserEvent.Presence, this.onUserPresenceChange);
            cli.removeListener(UserEvent.CurrentlyActive, this.onUserPresenceChange);
        }

        // cancel any pending calls to the rate_limited_funcs
        this.updateList.cancel();
    }

    private get canInvite(): boolean {
        const cli = MatrixClientPeg.safeGet();
        const room = cli.getRoom(this.props.roomId);

        return !!room && canInviteTo(room);
    }

    private getMembersState(invitedMembers: Array<RoomMember>, joinedMembers: Array<RoomMember>): IState {
        return {
            loading: false,
            filteredJoinedMembers: joinedMembers,
            filteredInvitedMembers: invitedMembers,
            canInvite: this.canInvite,

            // ideally we'd size this to the page height, but
            // in practice I find that a little constraining
            truncateAtJoined: INITIAL_LOAD_NUM_MEMBERS,
            truncateAtInvited: INITIAL_LOAD_NUM_INVITED,
        };
    }

    private onUserPresenceChange = (event: MatrixEvent | undefined, user: User): void => {
        // Attach a SINGLE listener for global presence changes then locate the
        // member tile and re-render it. This is more efficient than every tile
        // ever attaching their own listener.
        const tile = this.tiles.get(user.userId);
        if (tile) {
            this.updateList(); // reorder the membership list
        }
    };

    private onRoom = (room: Room): void => {
        if (room.roomId !== this.props.roomId) {
            return;
        }
        // We listen for room events because when we accept an invite
        // we need to wait till the room is fully populated with state
        // before refreshing the member list else we get a stale list.
        this.updateListNow(true);
    };

    private onMyMembership = (room: Room, membership: string, oldMembership?: string): void => {
        if (
            room.roomId === this.props.roomId &&
            membership === KnownMembership.Join &&
            oldMembership !== KnownMembership.Join
        ) {
            // we just joined the room, load the member list
            this.updateListNow(true);
        }
    };

    private onRoomStateUpdate = (state: RoomState): void => {
        if (state.roomId !== this.props.roomId) return;
        this.updateList();
    };

    private onRoomMemberName = (ev: MatrixEvent, member: RoomMember): void => {
        if (member.roomId !== this.props.roomId) {
            return;
        }
        this.updateList();
    };

    private onRoomStateEvent = (event: MatrixEvent): void => {
        if (event.getRoomId() === this.props.roomId && event.getType() === EventType.RoomThirdPartyInvite) {
            this.updateList();
        }

        if (this.canInvite !== this.state.canInvite) this.setState({ canInvite: this.canInvite });
    };

    private updateList = throttle(
        () => {
            this.updateListNow(false);
        },
        500,
        { leading: true, trailing: true },
    );

    // XXX: exported for tests
    public async updateListNow(showLoadingSpinner?: boolean): Promise<void> {
        if (!this.mounted) {
            return;
        }
        if (showLoadingSpinner) {
            this.setState({ loading: true });
        }
        const { joined, invited } = await this.context.memberListStore.loadMemberList(
            this.props.roomId,
            this.props.searchQuery,
        );
        if (!this.mounted) {
            return;
        }
        this.setState({
            loading: false,
            filteredJoinedMembers: joined,
            filteredInvitedMembers: invited,
        });
    }

    private createOverflowTileJoined = (overflowCount: number, totalCount: number): JSX.Element => {
        return this.createOverflowTile(overflowCount, totalCount, this.showMoreJoinedMemberList);
    };

    private createOverflowTileInvited = (overflowCount: number, totalCount: number): JSX.Element => {
        return this.createOverflowTile(overflowCount, totalCount, this.showMoreInvitedMemberList);
    };

    private createOverflowTile = (overflowCount: number, totalCount: number, onClick: () => void): JSX.Element => {
        // For now we'll pretend this is any entity. It should probably be a separate tile.
        const text = _t("common|and_n_others", { count: overflowCount });
        return (
            <EntityTile
                className="mx_EntityTile_ellipsis"
                avatarJsx={
                    <BaseAvatar url={require("../../../../res/img/ellipsis.svg").default} name="..." size="36px" />
                }
                name={text}
                showPresence={false}
                onClick={onClick}
            />
        );
    };

    private showMoreJoinedMemberList = (): void => {
        this.setState({
            truncateAtJoined: this.state.truncateAtJoined + SHOW_MORE_INCREMENT,
        });
    };

    private showMoreInvitedMemberList = (): void => {
        this.setState({
            truncateAtInvited: this.state.truncateAtInvited + SHOW_MORE_INCREMENT,
        });
    };

    public componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>, snapshot?: any): void {
        if (prevProps.searchQuery !== this.props.searchQuery) {
            this.updateListNow(false);
        }
    }

    private onSearchQueryChanged = (searchQuery: string): void => {
        this.props.onSearchQueryChanged(searchQuery);
    };

    private onPending3pidInviteClick = (inviteEvent: MatrixEvent): void => {
        dis.dispatch({
            action: Action.View3pidInvite,
            event: inviteEvent,
        });
    };

    private getPending3PidInvites(): MatrixEvent[] {
        // include 3pid invites (m.room.third_party_invite) state events.
        // The HS may have already converted these into m.room.member invites so
        // we shouldn't add them if the 3pid invite state key (token) is in the
        // member invite (content.third_party_invite.signed.token)
        const room = MatrixClientPeg.safeGet().getRoom(this.props.roomId);

        if (room) {
            return room.currentState.getStateEvents("m.room.third_party_invite").filter(function (e) {
                if (!isValid3pidInvite(e)) return false;

                // discard all invites which have a m.room.member event since we've
                // already added them.
                const memberEvent = room.currentState.getInviteForThreePidToken(e.getStateKey()!);
                if (memberEvent) return false;
                return true;
            });
        }

        return [];
    }

    private makeMemberTiles(members: Array<RoomMember | MatrixEvent>): JSX.Element[] {
        return members.map((m) => {
            if (m instanceof RoomMember) {
                // Is a Matrix invite
                return (
                    <MemberTile
                        key={m.userId}
                        member={m}
                        ref={(tile) => {
                            if (tile) this.tiles.set(m.userId, tile);
                            else this.tiles.delete(m.userId);
                        }}
                        showPresence={this.showPresence}
                    />
                );
            } else {
                // Is a 3pid invite
                return (
                    <EntityTile
                        key={m.getStateKey()}
                        name={m.getContent().display_name}
                        showPresence={false}
                        onClick={() => this.onPending3pidInviteClick(m)}
                    />
                );
            }
        });
    }

    private getChildrenJoined = (start: number, end: number): Array<JSX.Element> => {
        return this.makeMemberTiles(this.state.filteredJoinedMembers.slice(start, end));
    };

    private getChildCountJoined = (): number => this.state.filteredJoinedMembers.length;

    private getChildrenInvited = (start: number, end: number): Array<JSX.Element> => {
        let targets = this.state.filteredInvitedMembers;
        if (end > this.state.filteredInvitedMembers.length) {
            targets = targets.concat(this.getPending3PidInvites());
        }

        return this.makeMemberTiles(targets.slice(start, end));
    };

    private getChildCountInvited = (): number => {
        return this.state.filteredInvitedMembers.length + (this.getPending3PidInvites() || []).length;
    };

    public render(): React.ReactNode {
        if (this.state.loading) {
            return (
                <BaseCard className="mx_MemberList" onClose={this.props.onClose}>
                    <Spinner />
                </BaseCard>
            );
        }

        const cli = MatrixClientPeg.safeGet();
        const room = cli.getRoom(this.props.roomId);
        let inviteButton: JSX.Element | undefined;

        if (room?.getMyMembership() === KnownMembership.Join && shouldShowComponent(UIComponent.InviteUsers)) {
            const inviteButtonText = room.isSpaceRoom() ? _t("space|invite_this_space") : _t("room|invite_this_room");

            const button = (
                <Button
                    size="sm"
                    kind="secondary"
                    className="mx_MemberList_invite"
                    onClick={this.onInviteButtonClick}
                    disabled={!this.state.canInvite}
                >
                    <UserAddIcon width="1em" height="1em" />
                    {inviteButtonText}
                </Button>
            );

            if (this.state.canInvite) {
                inviteButton = button;
            } else {
                inviteButton = <Tooltip label={_t("member_list|invite_button_no_perms_tooltip")}>{button}</Tooltip>;
            }
        }

        let invitedHeader;
        let invitedSection;
        if (this.getChildCountInvited() > 0) {
            invitedHeader = <h2>{_t("member_list|invited_list_heading")}</h2>;
            invitedSection = (
                <TruncatedList
                    className="mx_MemberList_section mx_MemberList_invited"
                    truncateAt={this.state.truncateAtInvited}
                    createOverflowElement={this.createOverflowTileInvited}
                    getChildren={this.getChildrenInvited}
                    getChildCount={this.getChildCountInvited}
                />
            );
        }

        const footer = (
            <SearchBox
                className="mx_MemberList_query mx_textinput_icon mx_textinput_search"
                placeholder={_t("member_list|filter_placeholder")}
                onSearch={this.onSearchQueryChanged}
                initialValue={this.props.searchQuery}
            />
        );

        const scopeHeader = room ? <SpaceScopeHeader room={room} /> : undefined;

        return (
            <BaseCard
                className="mx_MemberList"
                header={<React.Fragment>{scopeHeader}</React.Fragment>}
                footer={footer}
                onClose={this.props.onClose}
            >
                {inviteButton}
                <div className="mx_MemberList_wrapper">
                    <TruncatedList
                        className="mx_MemberList_section mx_MemberList_joined"
                        truncateAt={this.state.truncateAtJoined}
                        createOverflowElement={this.createOverflowTileJoined}
                        getChildren={this.getChildrenJoined}
                        getChildCount={this.getChildCountJoined}
                    />
                    {invitedHeader}
                    {invitedSection}
                </div>
            </BaseCard>
        );
    }

    private onInviteButtonClick = (ev: ButtonEvent): void => {
        PosthogTrackers.trackInteraction("WebRightPanelMemberListInviteButton", ev);

        const cli = MatrixClientPeg.safeGet();
        const room = cli.getRoom(this.props.roomId)!;

        inviteToRoom(room);
    };
}
