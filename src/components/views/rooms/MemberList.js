/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017, 2018 New Vector Ltd

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
import createReactClass from 'create-react-class';
import { _t } from '../../../languageHandler';
import SdkConfig from '../../../SdkConfig';
import dis from '../../../dispatcher/dispatcher';
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import {isValid3pidInvite} from "../../../RoomInvite";
import rate_limited_func from "../../../ratelimitedfunc";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import * as sdk from "../../../index";
import CallHandler from "../../../CallHandler";

const INITIAL_LOAD_NUM_MEMBERS = 30;
const INITIAL_LOAD_NUM_INVITED = 5;
const SHOW_MORE_INCREMENT = 100;

// Regex applied to filter our punctuation in member names before applying sort, to fuzzy it a little
// matches all ASCII punctuation: !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~
const SORT_REGEX = /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]+/g;

export default createReactClass({
    displayName: 'MemberList',

    getInitialState: function() {
        const cli = MatrixClientPeg.get();
        if (cli.hasLazyLoadMembersEnabled()) {
            // show an empty list
            return this._getMembersState([]);
        } else {
            return this._getMembersState(this.roomMembers());
        }
    },

    // TODO: [REACT-WARNING] Move this to constructor
    UNSAFE_componentWillMount: function() {
        this._mounted = true;
        const cli = MatrixClientPeg.get();
        if (cli.hasLazyLoadMembersEnabled()) {
            this._showMembersAccordingToMembershipWithLL();
            cli.on("Room.myMembership", this.onMyMembership);
        } else {
            this._listenForMembersChanges();
        }
        cli.on("Room", this.onRoom); // invites & joining after peek
        const enablePresenceByHsUrl = SdkConfig.get()["enable_presence_by_hs_url"];
        const hsUrl = MatrixClientPeg.get().baseUrl;
        this._showPresence = true;
        if (enablePresenceByHsUrl && enablePresenceByHsUrl[hsUrl] !== undefined) {
            this._showPresence = enablePresenceByHsUrl[hsUrl];
        }
    },

    _listenForMembersChanges: function() {
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
    },

    componentWillUnmount: function() {
        this._mounted = false;
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
        this._updateList.cancelPendingCall();
    },

    /**
     * If lazy loading is enabled, either:
     * show a spinner and load the members if the user is joined,
     * or show the members available so far if the user is invited
     */
    _showMembersAccordingToMembershipWithLL: async function() {
        const cli = MatrixClientPeg.get();
        if (cli.hasLazyLoadMembersEnabled()) {
            const cli = MatrixClientPeg.get();
            const room = cli.getRoom(this.props.roomId);
            const membership = room && room.getMyMembership();
            if (membership === "join") {
                this.setState({loading: true});
                try {
                    await room.loadMembersIfNeeded();
                } catch (ex) {/* already logged in RoomView */}
                if (this._mounted) {
                    this.setState(this._getMembersState(this.roomMembers()));
                    this._listenForMembersChanges();
                }
            } else if (membership === "invite") {
                // show the members we've got when invited
                this.setState(this._getMembersState(this.roomMembers()));
            }
        }
    },

    _getMembersState: function(members) {
        // set the state after determining _showPresence to make sure it's
        // taken into account while rerendering
        return {
            loading: false,
            members: members,
            filteredJoinedMembers: this._filterMembers(members, 'join'),
            filteredInvitedMembers: this._filterMembers(members, 'invite'),

            // ideally we'd size this to the page height, but
            // in practice I find that a little constraining
            truncateAtJoined: INITIAL_LOAD_NUM_MEMBERS,
            truncateAtInvited: INITIAL_LOAD_NUM_INVITED,
            searchQuery: "",
        };
    },

    onUserPresenceChange(event, user) {
        // Attach a SINGLE listener for global presence changes then locate the
        // member tile and re-render it. This is more efficient than every tile
        // ever attaching their own listener.
        const tile = this.refs[user.userId];
        // console.log(`Got presence update for ${user.userId}. hasTile=${!!tile}`);
        if (tile) {
            this._updateList(); // reorder the membership list
        }
    },

    onRoom: function(room) {
        if (room.roomId !== this.props.roomId) {
            return;
        }
        // We listen for room events because when we accept an invite
        // we need to wait till the room is fully populated with state
        // before refreshing the member list else we get a stale list.
        this._showMembersAccordingToMembershipWithLL();
    },

    onMyMembership: function(room, membership, oldMembership) {
        if (room.roomId === this.props.roomId && membership === "join") {
            this._showMembersAccordingToMembershipWithLL();
        }
    },

    onRoomStateMember: function(ev, state, member) {
        if (member.roomId !== this.props.roomId) {
            return;
        }
        this._updateList();
    },

    onRoomMemberName: function(ev, member) {
        if (member.roomId !== this.props.roomId) {
            return;
        }
        this._updateList();
    },

    onRoomStateEvent: function(event, state) {
        if (event.getRoomId() === this.props.roomId &&
            event.getType() === "m.room.third_party_invite") {
            this._updateList();
        }
    },

    _updateList: rate_limited_func(function() {
        this._updateListNow();
    }, 500),

    _updateListNow: function() {
        // console.log("Updating memberlist");
        const newState = {
            loading: false,
            members: this.roomMembers(),
        };
        newState.filteredJoinedMembers = this._filterMembers(newState.members, 'join', this.state.searchQuery);
        newState.filteredInvitedMembers = this._filterMembers(newState.members, 'invite', this.state.searchQuery);
        this.setState(newState);
    },

    getMembersWithUser: function() {
        if (!this.props.roomId) return [];
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(this.props.roomId);
        if (!room) return [];

        const allMembers = Object.values(room.currentState.members);

        allMembers.forEach(function(member) {
            // work around a race where you might have a room member object
            // before the user object exists.  This may or may not cause
            // https://github.com/vector-im/vector-web/issues/186
            if (member.user === null) {
                member.user = cli.getUser(member.userId);
            }

            // XXX: this user may have no lastPresenceTs value!
            // the right solution here is to fix the race rather than leave it as 0
        });

        return allMembers;
    },

    roomMembers: function() {
        const ConferenceHandler = CallHandler.getConferenceHandler();

        const allMembers = this.getMembersWithUser();
        const filteredAndSortedMembers = allMembers.filter((m) => {
            return (
                m.membership === 'join' || m.membership === 'invite'
            ) && (
                !ConferenceHandler ||
                (ConferenceHandler && !ConferenceHandler.isConferenceUser(m.userId))
            );
        });
        filteredAndSortedMembers.sort(this.memberSort);
        return filteredAndSortedMembers;
    },

    _createOverflowTileJoined: function(overflowCount, totalCount) {
        return this._createOverflowTile(overflowCount, totalCount, this._showMoreJoinedMemberList);
    },

    _createOverflowTileInvited: function(overflowCount, totalCount) {
        return this._createOverflowTile(overflowCount, totalCount, this._showMoreInvitedMemberList);
    },

    _createOverflowTile: function(overflowCount, totalCount, onClick) {
        // For now we'll pretend this is any entity. It should probably be a separate tile.
        const EntityTile = sdk.getComponent("rooms.EntityTile");
        const BaseAvatar = sdk.getComponent("avatars.BaseAvatar");
        const text = _t("and %(count)s others...", { count: overflowCount });
        return (
            <EntityTile className="mx_EntityTile_ellipsis" avatarJsx={
                <BaseAvatar url={require("../../../../res/img/ellipsis.svg")} name="..." width={36} height={36} />
            } name={text} presenceState="online" suppressOnHover={true}
            onClick={onClick} />
        );
    },

    _showMoreJoinedMemberList: function() {
        this.setState({
            truncateAtJoined: this.state.truncateAtJoined + SHOW_MORE_INCREMENT,
        });
    },

    _showMoreInvitedMemberList: function() {
        this.setState({
            truncateAtInvited: this.state.truncateAtInvited + SHOW_MORE_INCREMENT,
        });
    },

    memberString: function(member) {
        if (!member) {
            return "(null)";
        } else {
            const u = member.user;
            return "(" + member.name + ", " + member.powerLevel + ", " + (u ? u.lastActiveAgo : "<null>") + ", " + (u ? u.getLastActiveTs() : "<null>") + ", " + (u ? u.currentlyActive : "<null>") + ", " + (u ? u.presence : "<null>") + ")";
        }
    },

    // returns negative if a comes before b,
    // returns 0 if a and b are equivalent in ordering
    // returns positive if a comes after b.
    memberSort: function(memberA, memberB) {
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
        if (this._showPresence) {
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
        if (this._showPresence && userA.getLastActiveTs() !== userB.getLastActiveTs()) {
            // console.log("Comparing on last active timestamp - returning");
            return userB.getLastActiveTs() - userA.getLastActiveTs();
        }

        // Fourth by name (alphabetical)
        const nameA = (memberA.name[0] === '@' ? memberA.name.substr(1) : memberA.name).replace(SORT_REGEX, "");
        const nameB = (memberB.name[0] === '@' ? memberB.name.substr(1) : memberB.name).replace(SORT_REGEX, "");
        // console.log(`Comparing userA_name=${nameA} against userB_name=${nameB} - returning`);
        return nameA.localeCompare(nameB, {
            ignorePunctuation: true,
            sensitivity: "base",
        });
    },

    onSearchQueryChanged: function(searchQuery) {
        this.setState({
            searchQuery,
            filteredJoinedMembers: this._filterMembers(this.state.members, 'join', searchQuery),
            filteredInvitedMembers: this._filterMembers(this.state.members, 'invite', searchQuery),
        });
    },

    _onPending3pidInviteClick: function(inviteEvent) {
        dis.dispatch({
            action: 'view_3pid_invite',
            event: inviteEvent,
        });
    },

    _filterMembers: function(members, membership, query) {
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
    },

    _getPending3PidInvites: function() {
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
    },

    _makeMemberTiles: function(members) {
        const MemberTile = sdk.getComponent("rooms.MemberTile");
        const EntityTile = sdk.getComponent("rooms.EntityTile");

        return members.map((m) => {
            if (m.userId) {
                // Is a Matrix invite
                return <MemberTile key={m.userId} member={m} ref={m.userId} showPresence={this._showPresence} />;
            } else {
                // Is a 3pid invite
                return <EntityTile key={m.getStateKey()} name={m.getContent().display_name} suppressOnHover={true}
                                   onClick={() => this._onPending3pidInviteClick(m)} />;
            }
        });
    },

    _getChildrenJoined: function(start, end) {
        return this._makeMemberTiles(this.state.filteredJoinedMembers.slice(start, end));
    },

    _getChildCountJoined: function() {
        return this.state.filteredJoinedMembers.length;
    },

    _getChildrenInvited: function(start, end) {
        let targets = this.state.filteredInvitedMembers;
        if (end > this.state.filteredInvitedMembers.length) {
            targets = targets.concat(this._getPending3PidInvites());
        }

        return this._makeMemberTiles(targets.slice(start, end));
    },

    _getChildCountInvited: function() {
        return this.state.filteredInvitedMembers.length + (this._getPending3PidInvites() || []).length;
    },

    render: function() {
        if (this.state.loading) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return <div className="mx_MemberList"><Spinner /></div>;
        }

        const SearchBox = sdk.getComponent('structures.SearchBox');
        const TruncatedList = sdk.getComponent("elements.TruncatedList");

        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(this.props.roomId);
        let inviteButton;

        if (room && room.getMyMembership() === 'join') {
            // assume we can invite until proven false
            let canInvite = true;

            const plEvent = room.currentState.getStateEvents("m.room.power_levels", "");
            const me = room.getMember(cli.getUserId());
            if (plEvent && me) {
                const content = plEvent.getContent();
                if (content && content.invite > me.powerLevel) {
                    canInvite = false;
                }
            }

            const AccessibleButton = sdk.getComponent("elements.AccessibleButton");
            inviteButton =
                <AccessibleButton className="mx_MemberList_invite" onClick={this.onInviteButtonClick} disabled={!canInvite}>
                    <span>{ _t('Invite to this room') }</span>
                </AccessibleButton>;
        }

        let invitedHeader;
        let invitedSection;
        if (this._getChildCountInvited() > 0) {
            invitedHeader = <h2>{ _t("Invited") }</h2>;
            invitedSection = <TruncatedList className="mx_MemberList_section mx_MemberList_invited" truncateAt={this.state.truncateAtInvited}
                        createOverflowElement={this._createOverflowTileInvited}
                        getChildren={this._getChildrenInvited}
                        getChildCount={this._getChildCountInvited}
                />;
        }

        return (
            <div className="mx_MemberList" role="tabpanel">
                { inviteButton }
                <AutoHideScrollbar>
                    <div className="mx_MemberList_wrapper">
                        <TruncatedList className="mx_MemberList_section mx_MemberList_joined" truncateAt={this.state.truncateAtJoined}
                            createOverflowElement={this._createOverflowTileJoined}
                            getChildren={this._getChildrenJoined}
                            getChildCount={this._getChildCountJoined} />
                        { invitedHeader }
                        { invitedSection }
                    </div>
                </AutoHideScrollbar>

                <SearchBox className="mx_MemberList_query mx_textinput_icon mx_textinput_search"
                           placeholder={ _t('Filter room members') }
                           onSearch={ this.onSearchQueryChanged } />
            </div>
        );
    },

    onInviteButtonClick: function() {
        if (MatrixClientPeg.get().isGuest()) {
            dis.dispatch({action: 'require_registration'});
            return;
        }

        // call AddressPickerDialog
        dis.dispatch({
            action: 'view_invite',
            roomId: this.props.roomId,
        });
    },
});
