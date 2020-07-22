/*
Copyright 2017 Vector Creations Ltd.
Copyright 2017 New Vector Ltd.
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
import createReactClass from 'create-react-class';
import { _t } from '../../../languageHandler';
import * as sdk from '../../../index';
import dis from '../../../dispatcher/dispatcher';
import GroupStore from '../../../stores/GroupStore';
import PropTypes from 'prop-types';
import { showGroupInviteDialog } from '../../../GroupAddressPicker';
import AccessibleButton from '../elements/AccessibleButton';
import {RightPanelPhases} from "../../../stores/RightPanelStorePhases";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import {Action} from "../../../dispatcher/actions";

const INITIAL_LOAD_NUM_MEMBERS = 30;

export default createReactClass({
    displayName: 'GroupMemberList',

    propTypes: {
        groupId: PropTypes.string.isRequired,
    },

    getInitialState: function() {
        return {
            members: null,
            membersError: null,
            invitedMembers: null,
            invitedMembersError: null,
            truncateAt: INITIAL_LOAD_NUM_MEMBERS,
        };
    },

    componentDidMount: function() {
        this._unmounted = false;
        this._initGroupStore(this.props.groupId);
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },

    _initGroupStore: function(groupId) {
        GroupStore.registerListener(groupId, () => {
            this._fetchMembers();
        });
        GroupStore.on('error', (err, errorGroupId, stateKey) => {
            if (this._unmounted || groupId !== errorGroupId) return;
            if (stateKey === GroupStore.STATE_KEY.GroupMembers) {
                this.setState({
                    membersError: err,
                });
            }
            if (stateKey === GroupStore.STATE_KEY.GroupInvitedMembers) {
                this.setState({
                    invitedMembersError: err,
                });
            }
        });
    },

    _fetchMembers: function() {
        if (this._unmounted) return;
        this.setState({
            members: GroupStore.getGroupMembers(this.props.groupId),
            invitedMembers: GroupStore.getGroupInvitedMembers(this.props.groupId),
        });
    },

    _createOverflowTile: function(overflowCount, totalCount) {
        // For now we'll pretend this is any entity. It should probably be a separate tile.
        const EntityTile = sdk.getComponent("rooms.EntityTile");
        const BaseAvatar = sdk.getComponent("avatars.BaseAvatar");
        const text = _t("and %(count)s others...", { count: overflowCount });
        return (
            <EntityTile className="mx_EntityTile_ellipsis" avatarJsx={
                <BaseAvatar url={require("../../../../res/img/ellipsis.svg")} name="..." width={36} height={36} />
            } name={text} presenceState="online" suppressOnHover={true}
            onClick={this._showFullMemberList} />
        );
    },

    _showFullMemberList: function() {
        this.setState({
            truncateAt: -1,
        });
    },

    onSearchQueryChanged: function(ev) {
        this.setState({ searchQuery: ev.target.value });
    },

    makeGroupMemberTiles: function(query, memberList, memberListError) {
        if (memberListError) {
            return <div className="warning">{ _t("Failed to load group members") }</div>;
        }

        const GroupMemberTile = sdk.getComponent("groups.GroupMemberTile");
        const TruncatedList = sdk.getComponent("elements.TruncatedList");
        query = (query || "").toLowerCase();
        if (query) {
            memberList = memberList.filter((m) => {
                const matchesName = (m.displayname || "").toLowerCase().includes(query);
                const matchesId = m.userId.toLowerCase().includes(query);

                if (!matchesName && !matchesId) {
                    return false;
                }

                return true;
            });
        }

        const uniqueMembers = {};
        memberList.forEach((m) => {
            if (!uniqueMembers[m.userId]) uniqueMembers[m.userId] = m;
        });
        memberList = Object.keys(uniqueMembers).map((userId) => uniqueMembers[userId]);
        // Descending sort on isPrivileged = true = 1 to isPrivileged = false = 0
        memberList.sort((a, b) => {
            if (a.isPrivileged === b.isPrivileged) {
                const aName = a.displayname || a.userId;
                const bName = b.displayname || b.userId;
                if (aName < bName) {
                    return -1;
                } else if (aName > bName) {
                    return 1;
                } else {
                    return 0;
                }
            } else {
                return a.isPrivileged ? -1 : 1;
            }
        });

        const memberTiles = memberList.map((m) => {
            return (
                <GroupMemberTile key={m.userId} groupId={this.props.groupId} member={m} />
            );
        });

        return <TruncatedList className="mx_MemberList_wrapper" truncateAt={this.state.truncateAt}
            createOverflowElement={this._createOverflowTile}
        >
            { memberTiles }
        </TruncatedList>;
    },

    onInviteToGroupButtonClick() {
        showGroupInviteDialog(this.props.groupId).then(() => {
            dis.dispatch({
                action: Action.SetRightPanelPhase,
                phase: RightPanelPhases.GroupMemberList,
                refireParams: { groupId: this.props.groupId },
            });
        });
    },

    render: function() {
        if (this.state.fetching || this.state.fetchingInvitedMembers) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return (<div className="mx_MemberList">
                <Spinner />
            </div>);
        }

        const inputBox = (
            <input className="mx_GroupMemberList_query mx_textinput" id="mx_GroupMemberList_query" type="text"
                    onChange={this.onSearchQueryChanged} value={this.state.searchQuery}
                    placeholder={_t('Filter community members')} autoComplete="off" />
        );

        const joined = this.state.members ? <div className="mx_MemberList_joined">
            {
                this.makeGroupMemberTiles(
                    this.state.searchQuery,
                    this.state.members,
                    this.state.membersError,
                )
            }
        </div> : <div />;

        const invited = (this.state.invitedMembers && this.state.invitedMembers.length > 0) ?
            <div className="mx_MemberList_invited">
                <h2>{_t("Invited")}</h2>
                {
                    this.makeGroupMemberTiles(
                        this.state.searchQuery,
                        this.state.invitedMembers,
                        this.state.invitedMembersError,
                    )
                }
            </div> : <div />;

        let inviteButton;
        if (GroupStore.isUserPrivileged(this.props.groupId)) {
            inviteButton = (
                <AccessibleButton
                    className="mx_MemberList_invite mx_MemberList_inviteCommunity"
                    onClick={this.onInviteToGroupButtonClick}
                >
                    <span>{ _t('Invite to this community') }</span>
                </AccessibleButton>
            );
        }

        return (
            <div className="mx_MemberList" role="tabpanel">
                { inviteButton }
                <AutoHideScrollbar>
                    { joined }
                    { invited }
                </AutoHideScrollbar>
                { inputBox }
            </div>
        );
    },
});
