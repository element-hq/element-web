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
import { _t } from '../../../languageHandler';
const MatrixClientPeg = require("../../../MatrixClientPeg");
const sdk = require('../../../index');
const GeminiScrollbar = require('react-gemini-scrollbar');
const rate_limited_func = require('../../../ratelimitedfunc');
const CallHandler = require("../../../CallHandler");

const INITIAL_LOAD_NUM_MEMBERS = 30;
const INITIAL_LOAD_NUM_INVITED = 5;
const SHOW_MORE_INCREMENT = 100;

module.exports = React.createClass({
    displayName: 'MemberList',

    getInitialState: function() {
        this.memberDict = this.getMemberDict();
        const members = this.roomMembers();

        return {
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

    componentWillMount: function() {
        const cli = MatrixClientPeg.get();
        cli.on("RoomState.members", this.onRoomStateMember);
        cli.on("RoomMember.name", this.onRoomMemberName);
        cli.on("RoomState.events", this.onRoomStateEvent);
        cli.on("Room", this.onRoom); // invites
        // We listen for changes to the lastPresenceTs which is essentially
        // listening for all presence events (we display most of not all of
        // the information contained in presence events).
        cli.on("User.lastPresenceTs", this.onUserLastPresenceTs);
        // cli.on("Room.timeline", this.onRoomTimeline);
    },

    componentWillUnmount: function() {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("RoomState.members", this.onRoomStateMember);
            cli.removeListener("RoomMember.name", this.onRoomMemberName);
            cli.removeListener("RoomState.events", this.onRoomStateEvent);
            cli.removeListener("Room", this.onRoom);
            cli.removeListener("User.lastPresenceTs", this.onUserLastPresenceTs);
            // cli.removeListener("Room.timeline", this.onRoomTimeline);
        }

        // cancel any pending calls to the rate_limited_funcs
        this._updateList.cancelPendingCall();
    },

/*
    onRoomTimeline: function(ev, room, toStartOfTimeline, removed, data) {
        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data || !data.liveEvent) return;

        // treat any activity from a user as implicit presence to update the
        // ordering of the list whenever someone says something.
        // Except right now we're not tiebreaking "active now" users in this way
        // so don't bother for now.
        if (ev.getSender()) {
            // console.log("implicit presence from " + ev.getSender());

            var tile = this.refs[ev.getSender()];
            if (tile) {
                // work around a race where you might have a room member object
                // before the user object exists.  XXX: why does this ever happen?
                var all_members = room.currentState.members;
                var userId = ev.getSender();
                if (all_members[userId].user === null) {
                    all_members[userId].user = MatrixClientPeg.get().getUser(userId);
                }
                this._updateList(); // reorder the membership list
            }
        }
    },
*/

    onUserLastPresenceTs(event, user) {
        // Attach a SINGLE listener for global presence changes then locate the
        // member tile and re-render it. This is more efficient than every tile
        // evar attaching their own listener.
        // console.log("explicit presence from " + user.userId);
        const tile = this.refs[user.userId];
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
        this._updateList();
    },

    onRoomStateMember: function(ev, state, member) {
        this._updateList();
    },

    onRoomMemberName: function(ev, member) {
        this._updateList();
    },

    onRoomStateEvent: function(event, state) {
        if (event.getType() === "m.room.third_party_invite") {
            this._updateList();
        }
    },

    _updateList: new rate_limited_func(function() {
        // console.log("Updating memberlist");
        this.memberDict = this.getMemberDict();

        const newState = {
            members: this.roomMembers(),
        };
        newState.filteredJoinedMembers = this._filterMembers(newState.members, 'join', this.state.searchQuery);
        newState.filteredInvitedMembers = this._filterMembers(newState.members, 'invite', this.state.searchQuery);
        this.setState(newState);
    }, 500),

    getMemberDict: function() {
        if (!this.props.roomId) return {};
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(this.props.roomId);
        if (!room) return {};

        const all_members = room.currentState.members;

        Object.keys(all_members).map(function(userId) {
            // work around a race where you might have a room member object
            // before the user object exists.  This may or may not cause
            // https://github.com/vector-im/vector-web/issues/186
            if (all_members[userId].user === null) {
                all_members[userId].user = MatrixClientPeg.get().getUser(userId);
            }

            // XXX: this user may have no lastPresenceTs value!
            // the right solution here is to fix the race rather than leave it as 0
        });

        return all_members;
    },

    roomMembers: function() {
        const all_members = this.memberDict || {};
        const all_user_ids = Object.keys(all_members);
        const ConferenceHandler = CallHandler.getConferenceHandler();

        all_user_ids.sort(this.memberSort);

        const to_display = [];
        let count = 0;
        for (let i = 0; i < all_user_ids.length; ++i) {
            const user_id = all_user_ids[i];
            const m = all_members[user_id];

            if (m.membership === 'join' || m.membership === 'invite') {
                if ((ConferenceHandler && !ConferenceHandler.isConferenceUser(user_id)) || !ConferenceHandler) {
                    to_display.push(user_id);
                    ++count;
                }
            }
        }
        return to_display;
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
                <BaseAvatar url="img/ellipsis.svg" name="..." width={36} height={36} />
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
            return "(" + member.name + ", " + member.powerLevel + ", " + member.user.lastActiveAgo + ", " + member.user.currentlyActive + ")";
        }
    },

    // returns negative if a comes before b,
    // returns 0 if a and b are equivalent in ordering
    // returns positive if a comes after b.
    memberSort: function(userIdA, userIdB) {
            // order by last active, with "active now" first.
            // ...and then by power
            // ...and then alphabetically.
            // We could tiebreak instead by "last recently spoken in this room" if we wanted to.

            const memberA = this.memberDict[userIdA];
            const memberB = this.memberDict[userIdB];
            const userA = memberA.user;
            const userB = memberB.user;

            // if (!userA || !userB) {
            //     console.log("comparing " + memberA.name + " user=" + memberA.user + " with " + memberB.name + " user=" + memberB.user);
            // }

            if (!userA && !userB) return 0;
            if (userA && !userB) return -1;
            if (!userA && userB) return 1;

            // console.log("comparing " + this.memberString(memberA) + " and " + this.memberString(memberB));

            if (userA.currentlyActive && userB.currentlyActive) {
                // console.log(memberA.name + " and " + memberB.name + " are both active");
                if (memberA.powerLevel === memberB.powerLevel) {
                    // console.log(memberA + " and " + memberB + " have same power level");
                    if (memberA.name && memberB.name) {
                        // console.log("comparing names: " + memberA.name + " and " + memberB.name);
                        const nameA = memberA.name[0] === '@' ? memberA.name.substr(1) : memberA.name;
                        const nameB = memberB.name[0] === '@' ? memberB.name.substr(1) : memberB.name;
                        return nameA.localeCompare(nameB);
                    } else {
                        return 0;
                    }
                } else {
                    // console.log("comparing power: " + memberA.powerLevel + " and " + memberB.powerLevel);
                    return memberB.powerLevel - memberA.powerLevel;
                }
            }

            if (userA.currentlyActive && !userB.currentlyActive) return -1;
            if (!userA.currentlyActive && userB.currentlyActive) return 1;

            // For now, let's just order things by timestamp. It's really annoying
            // that a user disappears from sight just because they temporarily go offline
            return userB.getLastActiveTs() - userA.getLastActiveTs();
    },

    onSearchQueryChanged: function(ev) {
        const q = ev.target.value;
        this.setState({
            searchQuery: q,
            filteredJoinedMembers: this._filterMembers(this.state.members, 'join', q),
            filteredInvitedMembers: this._filterMembers(this.state.members, 'invite', q),
        });
    },

    _filterMembers: function(members, membership, query) {
        return members.filter((userId) => {
            const m = this.memberDict[userId];

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
                // any events without these keys are not valid 3pid invites, so we ignore them
                const requiredKeys = ['key_validity_url', 'public_key', 'display_name'];
                for (let i = 0; i < requiredKeys.length; ++i) {
                    if (e.getContent()[requiredKeys[i]] === undefined) return false;
                }

                // discard all invites which have a m.room.member event since we've
                // already added them.
                const memberEvent = room.currentState.getInviteForThreePidToken(e.getStateKey());
                if (memberEvent) return false;
                return true;
            });
        }
    },

    _makeMemberTiles: function(members, membership) {
        const MemberTile = sdk.getComponent("rooms.MemberTile");

        const memberList = members.map((userId) => {
            const m = this.memberDict[userId];
            return (
                <MemberTile key={userId} member={m} ref={userId} />
            );
        });

        // XXX: surely this is not the right home for this logic.
        // Double XXX: Now it's really, really not the right home for this logic:
        // we shouldn't even be passing in the 'membership' param to this function.
        // Ew, ew, and ew.
        // Triple XXX: This violates the size constraint, the output is expected/desired
        // to be the same length as the members input array.
        if (membership === "invite") {
            const EntityTile = sdk.getComponent("rooms.EntityTile");
            memberList.push(...this._getPending3PidInvites().map((e) => {
                return <EntityTile key={e.getStateKey()} name={e.getContent().display_name} suppressOnHover={true} />;
            }));
        }

        return memberList;
    },

    _getChildrenJoined: function(start, end) {
        return this._makeMemberTiles(this.state.filteredJoinedMembers.slice(start, end));
    },

    _getChildCountJoined: function() {
        return this.state.filteredJoinedMembers.length;
    },

    _getChildrenInvited: function(start, end) {
        return this._makeMemberTiles(this.state.filteredInvitedMembers.slice(start, end), 'invite');
    },

    _getChildCountInvited: function() {
        return this.state.filteredInvitedMembers.length + (this._getPending3PidInvites() || []).length;
    },

    render: function() {
        const TruncatedList = sdk.getComponent("elements.TruncatedList");

        let invitedSection = null;
        if (this._getChildCountInvited() > 0) {
            invitedSection = (
                <div className="mx_MemberList_invited">
                    <h2>{ _t("Invited") }</h2>
                    <div className="mx_MemberList_wrapper">
                        <TruncatedList className="mx_MemberList_wrapper" truncateAt={this.state.truncateAtInvited}
                                createOverflowElement={this._createOverflowTileInvited}
                                getChildren={this._getChildrenInvited}
                                getChildCount={this._getChildCountInvited}
                        />
                    </div>
                </div>
            );
        }

        const inputBox = (
            <form autoComplete="off">
                <input className="mx_MemberList_query" id="mx_MemberList_query" type="text"
                        onChange={this.onSearchQueryChanged} value={this.state.searchQuery}
                        placeholder={_t('Filter room members')} />
            </form>
        );

        return (
            <div className="mx_MemberList">
                { inputBox }
                <GeminiScrollbar autoshow={true} className="mx_MemberList_joined mx_MemberList_outerWrapper">
                    <TruncatedList className="mx_MemberList_wrapper" truncateAt={this.state.truncateAtJoined}
                            createOverflowElement={this._createOverflowTileJoined}
                            getChildren={this._getChildrenJoined}
                            getChildCount={this._getChildCountJoined}
                    />
                    { invitedSection }
                </GeminiScrollbar>
            </div>
        );
    },
});
