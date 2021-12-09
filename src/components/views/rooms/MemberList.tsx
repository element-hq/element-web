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

import React from 'react';
import { _t } from '../../../languageHandler';
import SdkConfig from '../../../SdkConfig';
import dis from '../../../dispatcher/dispatcher';
import { isValid3pidInvite } from "../../../RoomInvite";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { CommunityPrototypeStore } from "../../../stores/CommunityPrototypeStore";
import BaseCard from "../right_panel/BaseCard";
import { RightPanelPhases } from "../../../stores/RightPanelStorePhases";
import RoomAvatar from "../avatars/RoomAvatar";
import RoomName from "../elements/RoomName";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import SettingsStore from "../../../settings/SettingsStore";
import { MatrixEvent } from 'matrix-js-sdk/src/models/event';
import { Room } from 'matrix-js-sdk/src/models/room';
import { RoomMember } from 'matrix-js-sdk/src/models/room-member';
import { RoomState } from 'matrix-js-sdk/src/models/room-state';
import { User } from "matrix-js-sdk/src/models/user";
import TruncatedList from '../elements/TruncatedList';
import Spinner from "../elements/Spinner";
import SearchBox from "../../structures/SearchBox";
import AccessibleButton from '../elements/AccessibleButton';
import EntityTile from "./EntityTile";
import MemberTile from "./MemberTile";
import BaseAvatar from '../avatars/BaseAvatar';
import { throttle } from 'lodash';
import SpaceStore from "../../../stores/spaces/SpaceStore";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { JoinRule } from "matrix-js-sdk/src/@types/partials";

const INITIAL_LOAD_NUM_MEMBERS = 30;
const INITIAL_LOAD_NUM_INVITED = 5;
const SHOW_MORE_INCREMENT = 100;

// Regex applied to filter our punctuation in member names before applying sort, to fuzzy it a little
// matches all ASCII punctuation: !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~
const SORT_REGEX = /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]+/g;

interface IProps {
    roomId: string;
    searchQuery: string;
    onClose(): void;
    onSearchQueryChanged: (query: string) => void;
}

interface IState {
    loading: boolean;
    members: Array<RoomMember>;
    filteredJoinedMembers: Array<RoomMember>;
    filteredInvitedMembers: Array<RoomMember | MatrixEvent>;
    canInvite: boolean;
    truncateAtJoined: number;
    truncateAtInvited: number;
}

@replaceableComponent("views.rooms.MemberList")
export default class MemberList extends React.Component<IProps, IState> {
    private showPresence = true;
    private mounted = false;
    private collator: Intl.Collator;
    private sortNames = new Map<RoomMember, string>(); // RoomMember -> sortName

    constructor(props) {
        super(props);

        const cli = MatrixClientPeg.get();
        if (cli.hasLazyLoadMembersEnabled()) {
            // show an empty list
            this.state = this.getMembersState([]);
        } else {
            this.state = this.getMembersState(this.roomMembers());
        }

        cli.on("Room", this.onRoom); // invites & joining after peek
        const enablePresenceByHsUrl = SdkConfig.get()["enable_presence_by_hs_url"];
        const hsUrl = MatrixClientPeg.get().baseUrl;
        this.showPresence = enablePresenceByHsUrl?.[hsUrl] ?? true;
    }

    // eslint-disable-next-line
    UNSAFE_componentWillMount() {
        const cli = MatrixClientPeg.get();
        this.mounted = true;
        if (cli.hasLazyLoadMembersEnabled()) {
            this.showMembersAccordingToMembershipWithLL();
            cli.on("Room.myMembership", this.onMyMembership);
        } else {
            this.listenForMembersChanges();
        }
    }

    private listenForMembersChanges(): void {
        const cli = MatrixClientPeg.get();
        cli.on("RoomState.members", this.onRoomStateMember);
        cli.on("RoomMember.name", this.onRoomMemberName);
        cli.on("RoomState.events", this.onRoomStateEvent);
        // We listen for changes to the lastPresenceTs which is essentially
        // listening for all presence events (we display most of not all of
        // the information contained in presence events).
        cli.on("User.lastPresenceTs", this.onUserPresenceChange);
        cli.on("User.presence", this.onUserPresenceChange);
        cli.on("User.currentlyActive", this.onUserPresenceChange);
        // cli.on("Room.timeline", this.onRoomTimeline);
    }

    componentWillUnmount() {
        this.mounted = false;
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("RoomState.members", this.onRoomStateMember);
            cli.removeListener("RoomMember.name", this.onRoomMemberName);
            cli.removeListener("Room.myMembership", this.onMyMembership);
            cli.removeListener("RoomState.events", this.onRoomStateEvent);
            cli.removeListener("Room", this.onRoom);
            cli.removeListener("User.lastPresenceTs", this.onUserPresenceChange);
            cli.removeListener("User.presence", this.onUserPresenceChange);
            cli.removeListener("User.currentlyActive", this.onUserPresenceChange);
        }

        // cancel any pending calls to the rate_limited_funcs
        this.updateList.cancel();
    }

    /**
     * If lazy loading is enabled, either:
     * show a spinner and load the members if the user is joined,
     * or show the members available so far if the user is invited
     */
    private async showMembersAccordingToMembershipWithLL(): Promise<void> {
        const cli = MatrixClientPeg.get();
        if (cli.hasLazyLoadMembersEnabled()) {
            const cli = MatrixClientPeg.get();
            const room = cli.getRoom(this.props.roomId);
            const membership = room && room.getMyMembership();
            if (membership === "join") {
                this.setState({ loading: true });
                try {
                    await room.loadMembersIfNeeded();
                } catch (ex) {/* already logged in RoomView */}
                if (this.mounted) {
                    this.setState(this.getMembersState(this.roomMembers()));
                    this.listenForMembersChanges();
                }
            } else {
                // show the members we already have loaded
                this.setState(this.getMembersState(this.roomMembers()));
            }
        }
    }

    private get canInvite(): boolean {
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(this.props.roomId);

        return (
            room?.canInvite(cli.getUserId()) ||
            (room?.isSpaceRoom() && room.getJoinRule() === JoinRule.Public)
        );
    }

    private getMembersState(members: Array<RoomMember>): IState {
        // set the state after determining showPresence to make sure it's
        // taken into account while rendering
        return {
            loading: false,
            members: members,
            filteredJoinedMembers: this.filterMembers(members, 'join', this.props.searchQuery),
            filteredInvitedMembers: this.filterMembers(members, 'invite', this.props.searchQuery),
            canInvite: this.canInvite,

            // ideally we'd size this to the page height, but
            // in practice I find that a little constraining
            truncateAtJoined: INITIAL_LOAD_NUM_MEMBERS,
            truncateAtInvited: INITIAL_LOAD_NUM_INVITED,
        };
    }

    private onUserPresenceChange = (event: MatrixEvent, user: User): void => {
        // Attach a SINGLE listener for global presence changes then locate the
        // member tile and re-render it. This is more efficient than every tile
        // ever attaching their own listener.
        const tile = this.refs[user.userId];
        // console.log(`Got presence update for ${user.userId}. hasTile=${!!tile}`);
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
        this.showMembersAccordingToMembershipWithLL();
    };

    private onMyMembership = (room: Room, membership: string, oldMembership: string): void => {
        if (room.roomId === this.props.roomId && membership === "join") {
            this.showMembersAccordingToMembershipWithLL();
        }
    };

    private onRoomStateMember = (ev: MatrixEvent, state: RoomState, member: RoomMember): void => {
        if (member.roomId !== this.props.roomId) {
            return;
        }
        this.updateList();
    };

    private onRoomMemberName = (ev: MatrixEvent, member: RoomMember): void => {
        if (member.roomId !== this.props.roomId) {
            return;
        }
        this.updateList();
    };

    private onRoomStateEvent = (event: MatrixEvent, state: RoomState): void => {
        if (event.getRoomId() === this.props.roomId &&
            event.getType() === "m.room.third_party_invite") {
            this.updateList();
        }

        if (this.canInvite !== this.state.canInvite) this.setState({ canInvite: this.canInvite });
    };

    private updateList = throttle(() => {
        this.updateListNow();
    }, 500, { leading: true, trailing: true });

    private updateListNow(): void {
        const members = this.roomMembers();

        this.setState({
            loading: false,
            members: members,
            filteredJoinedMembers: this.filterMembers(members, 'join', this.props.searchQuery),
            filteredInvitedMembers: this.filterMembers(members, 'invite', this.props.searchQuery),
        });
    }

    private getMembersWithUser(): Array<RoomMember> {
        if (!this.props.roomId) return [];
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(this.props.roomId);
        if (!room) return [];

        const allMembers = Object.values(room.currentState.members);

        allMembers.forEach((member) => {
            // work around a race where you might have a room member object
            // before the user object exists. This may or may not cause
            // https://github.com/vector-im/vector-web/issues/186
            if (!member.user) {
                member.user = cli.getUser(member.userId);
            }

            this.sortNames.set(
                member,
                (member.name[0] === '@' ? member.name.substr(1) : member.name).replace(SORT_REGEX, ""),
            );

            // XXX: this user may have no lastPresenceTs value!
            // the right solution here is to fix the race rather than leave it as 0
        });

        return allMembers;
    }

    private roomMembers(): Array<RoomMember> {
        const allMembers = this.getMembersWithUser();
        const filteredAndSortedMembers = allMembers.filter((m) => {
            return (
                m.membership === 'join' || m.membership === 'invite'
            );
        });
        const language = SettingsStore.getValue("language");
        this.collator = new Intl.Collator(language, { sensitivity: 'base', ignorePunctuation: false });
        filteredAndSortedMembers.sort(this.memberSort);
        return filteredAndSortedMembers;
    }

    private createOverflowTileJoined = (overflowCount: number, totalCount: number): JSX.Element => {
        return this.createOverflowTile(overflowCount, totalCount, this.showMoreJoinedMemberList);
    };

    private createOverflowTileInvited = (overflowCount: number, totalCount: number): JSX.Element => {
        return this.createOverflowTile(overflowCount, totalCount, this.showMoreInvitedMemberList);
    };

    private createOverflowTile = (overflowCount: number, totalCount: number, onClick: () => void): JSX.Element=> {
        // For now we'll pretend this is any entity. It should probably be a separate tile.
        const text = _t("and %(count)s others...", { count: overflowCount });
        return (
            <EntityTile
                className="mx_EntityTile_ellipsis"
                avatarJsx={
                    <BaseAvatar url={require("../../../../res/img/ellipsis.svg")} name="..." width={36} height={36} />
                }
                name={text}
                presenceState="online"
                suppressOnHover={true}
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

    /**
     * SHOULD ONLY BE USED BY TESTS
     */
    public memberString(member: RoomMember): string {
        if (!member) {
            return "(null)";
        } else {
            const u = member.user;
            return (
                "(" +
                member.name +
                ", " +
                member.powerLevel +
                ", " +
                (u ? u.lastActiveAgo : "<null>") +
                ", " +
                (u ? u.getLastActiveTs() : "<null>") +
                ", " +
                (u ? u.currentlyActive : "<null>") +
                ", " +
                (u ? u.presence : "<null>") +
                ")"
            );
        }
    }

    // returns negative if a comes before b,
    // returns 0 if a and b are equivalent in ordering
    // returns positive if a comes after b.
    private memberSort = (memberA: RoomMember, memberB: RoomMember): number => {
        // order by presence, with "active now" first.
        // ...and then by power level
        // ...and then by last active
        // ...and then alphabetically.
        // We could tiebreak instead by "last recently spoken in this room" if we wanted to.

        // console.log(`Comparing userA=${this.memberString(memberA)} userB=${this.memberString(memberB)}`);

        const userA = memberA.user;
        const userB = memberB.user;

        // if (!userA) console.log("!! MISSING USER FOR A-SIDE: " + memberA.name + " !!");
        // if (!userB) console.log("!! MISSING USER FOR B-SIDE: " + memberB.name + " !!");

        if (!userA && !userB) return 0;
        if (userA && !userB) return -1;
        if (!userA && userB) return 1;

        // First by presence
        if (this.showPresence) {
            const convertPresence = (p) => p === 'unavailable' ? 'online' : p;
            const presenceIndex = p => {
                const order = ['active', 'online', 'offline'];
                const idx = order.indexOf(convertPresence(p));
                return idx === -1 ? order.length : idx; // unknown states at the end
            };

            const idxA = presenceIndex(userA.currentlyActive ? 'active' : userA.presence);
            const idxB = presenceIndex(userB.currentlyActive ? 'active' : userB.presence);
            // console.log(`userA_presenceGroup=${idxA} userB_presenceGroup=${idxB}`);
            if (idxA !== idxB) {
                // console.log("Comparing on presence group - returning");
                return idxA - idxB;
            }
        }

        // Second by power level
        if (memberA.powerLevel !== memberB.powerLevel) {
            // console.log("Comparing on power level - returning");
            return memberB.powerLevel - memberA.powerLevel;
        }

        // Third by last active
        if (this.showPresence && userA.getLastActiveTs() !== userB.getLastActiveTs()) {
            // console.log("Comparing on last active timestamp - returning");
            return userB.getLastActiveTs() - userA.getLastActiveTs();
        }

        // Fourth by name (alphabetical)
        return this.collator.compare(this.sortNames.get(memberA), this.sortNames.get(memberB));
    };

    private onSearchQueryChanged = (searchQuery: string): void => {
        this.props.onSearchQueryChanged(searchQuery);
        this.setState({
            filteredJoinedMembers: this.filterMembers(this.state.members, 'join', searchQuery),
            filteredInvitedMembers: this.filterMembers(this.state.members, 'invite', searchQuery),
        });
    };

    private onPending3pidInviteClick = (inviteEvent: MatrixEvent): void => {
        dis.dispatch({
            action: 'view_3pid_invite',
            event: inviteEvent,
        });
    };

    private filterMembers(members: Array<RoomMember>, membership: string, query?: string): Array<RoomMember> {
        return members.filter((m) => {
            if (query) {
                query = query.toLowerCase();
                const matchesName = m.name.toLowerCase().indexOf(query) !== -1;
                const matchesId = m.userId.toLowerCase().indexOf(query) !== -1;

                if (!matchesName && !matchesId) {
                    return false;
                }
            }

            return m.membership === membership;
        });
    }

    private getPending3PidInvites(): Array<MatrixEvent> {
        // include 3pid invites (m.room.third_party_invite) state events.
        // The HS may have already converted these into m.room.member invites so
        // we shouldn't add them if the 3pid invite state key (token) is in the
        // member invite (content.third_party_invite.signed.token)
        const room = MatrixClientPeg.get().getRoom(this.props.roomId);

        if (room) {
            return room.currentState.getStateEvents("m.room.third_party_invite").filter(function(e) {
                if (!isValid3pidInvite(e)) return false;

                // discard all invites which have a m.room.member event since we've
                // already added them.
                const memberEvent = room.currentState.getInviteForThreePidToken(e.getStateKey());
                if (memberEvent) return false;
                return true;
            });
        }
    }

    private makeMemberTiles(members: Array<RoomMember | MatrixEvent>) {
        return members.map((m) => {
            if (m instanceof RoomMember) {
                // Is a Matrix invite
                return <MemberTile key={m.userId} member={m} ref={m.userId} showPresence={this.showPresence} />;
            } else {
                // Is a 3pid invite
                return <EntityTile
                    key={m.getStateKey()}
                    name={m.getContent().display_name}
                    suppressOnHover={true}
                    onClick={() => this.onPending3pidInviteClick(m)}
                />;
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

    render() {
        if (this.state.loading) {
            return <BaseCard
                className="mx_MemberList"
                onClose={this.props.onClose}
                previousPhase={RightPanelPhases.RoomSummary}
            >
                <Spinner />
            </BaseCard>;
        }

        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(this.props.roomId);
        let inviteButton;

        if (room?.getMyMembership() === 'join' && shouldShowComponent(UIComponent.InviteUsers)) {
            let inviteButtonText = _t("Invite to this room");
            const chat = CommunityPrototypeStore.instance.getSelectedCommunityGeneralChat();
            if (chat && chat.roomId === this.props.roomId) {
                inviteButtonText = _t("Invite to this community");
            } else if (SpaceStore.spacesEnabled && room.isSpaceRoom()) {
                inviteButtonText = _t("Invite to this space");
            }

            inviteButton = (
                <AccessibleButton
                    className="mx_MemberList_invite"
                    onClick={this.onInviteButtonClick}
                    disabled={!this.state.canInvite}
                >
                    <span>{ inviteButtonText }</span>
                </AccessibleButton>
            );
        }

        let invitedHeader;
        let invitedSection;
        if (this.getChildCountInvited() > 0) {
            invitedHeader = <h2>{ _t("Invited") }</h2>;
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
                placeholder={_t('Filter room members')}
                onSearch={this.onSearchQueryChanged}
                initialValue={this.props.searchQuery}
            />
        );

        let previousPhase = RightPanelPhases.RoomSummary;
        // We have no previousPhase for when viewing a MemberList from a Space
        let scopeHeader;
        if (SpaceStore.spacesEnabled && room?.isSpaceRoom()) {
            previousPhase = undefined;
            scopeHeader = <div className="mx_RightPanel_scopeHeader">
                <RoomAvatar room={room} height={32} width={32} />
                <RoomName room={room} />
            </div>;
        }

        return <BaseCard
            className="mx_MemberList"
            header={<React.Fragment>
                { scopeHeader }
                { inviteButton }
            </React.Fragment>}
            footer={footer}
            onClose={this.props.onClose}
            previousPhase={previousPhase}
        >
            <div className="mx_MemberList_wrapper">
                <TruncatedList
                    className="mx_MemberList_section mx_MemberList_joined"
                    truncateAt={this.state.truncateAtJoined}
                    createOverflowElement={this.createOverflowTileJoined}
                    getChildren={this.getChildrenJoined}
                    getChildCount={this.getChildCountJoined} />
                { invitedHeader }
                { invitedSection }
            </div>
        </BaseCard>;
    }

    onInviteButtonClick = (): void => {
        if (MatrixClientPeg.get().isGuest()) {
            dis.dispatch({ action: 'require_registration' });
            return;
        }

        // call AddressPickerDialog
        dis.dispatch({
            action: 'view_invite',
            roomId: this.props.roomId,
        });
    };
}
