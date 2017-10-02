/*
Copyright 2017 Vector Creations Ltd.
Copyright 2017 New Vector Ltd.

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
import sdk from '../../../index';
import { groupMemberFromApiObject } from '../../../groups';
import GeminiScrollbar from 'react-gemini-scrollbar';
import PropTypes from 'prop-types';
import withMatrixClient from '../../../wrappers/withMatrixClient';

const INITIAL_LOAD_NUM_MEMBERS = 30;

export default withMatrixClient(React.createClass({
    displayName: 'GroupMemberList',

    propTypes: {
        matrixClient: PropTypes.object.isRequired,
        groupId: PropTypes.string.isRequired,
    },

    getInitialState: function() {
        return {
            fetching: false,
            members: null,
            truncateAt: INITIAL_LOAD_NUM_MEMBERS,
        };
    },

    componentWillMount: function() {
        this._unmounted = false;
        this._fetchMembers();
    },

    _fetchMembers: function() {
        this.setState({fetching: true});
        this.props.matrixClient.getGroupUsers(this.props.groupId).then((result) => {
            this.setState({
                members: result.chunk.map((apiMember) => {
                    return groupMemberFromApiObject(apiMember);
                }),
                fetching: false,
            });
        }).catch((e) => {
            this.setState({fetching: false});
            console.error("Failed to get group member list: " + e);
        });
    },

    _createOverflowTile: function(overflowCount, totalCount) {
        // For now we'll pretend this is any entity. It should probably be a separate tile.
        const EntityTile = sdk.getComponent("rooms.EntityTile");
        const BaseAvatar = sdk.getComponent("avatars.BaseAvatar");
        const text = _t("and %(count)s others...", { count: overflowCount });
        return (
            <EntityTile className="mx_EntityTile_ellipsis" avatarJsx={
                <BaseAvatar url="img/ellipsis.svg" name="..." width={36} height={36} />
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

    makeGroupMemberTiles: function(query) {
        const GroupMemberTile = sdk.getComponent("groups.GroupMemberTile");
        query = (query || "").toLowerCase();

        let memberList = this.state.members;
        if (query) {
            memberList = memberList.filter((m) => {
                const matchesName = m.displayname.toLowerCase().indexOf(query) !== -1;
                const matchesId = m.userId.toLowerCase().includes(query);

                if (!matchesName && !matchesId) {
                    return false;
                }

                return true;
            });
        }

        memberList = memberList.map((m) => {
            return (
                <GroupMemberTile key={m.userId} groupId={this.props.groupId} member={m} />
            );
        });

        memberList.sort((a, b) => {
            // TODO: should put admins at the top: we don't yet have that info
            if (a < b) {
                return -1;
            } else if (a > b) {
                return 1;
            } else {
                return 0;
            }
        });

        return memberList;
    },

    render: function() {
        if (this.state.fetching) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return (<div className="mx_MemberList">
                <Spinner />
            </div>);
        } else if (this.state.members === null) {
            return null;
        }

        const inputBox = (
            <form autoComplete="off">
                <input className="mx_GroupMemberList_query" id="mx_GroupMemberList_query" type="text"
                        onChange={this.onSearchQueryChanged} value={this.state.searchQuery}
                        placeholder={_t('Filter group members')} />
            </form>
        );

        const TruncatedList = sdk.getComponent("elements.TruncatedList");
        return (
            <div className="mx_MemberList">
                { inputBox }
                <GeminiScrollbar autoshow={true} className="mx_MemberList_joined mx_MemberList_outerWrapper">
                    <TruncatedList className="mx_MemberList_wrapper" truncateAt={this.state.truncateAt}
                            createOverflowElement={this._createOverflowTile}>
                        { this.makeGroupMemberTiles(this.state.searchQuery) }
                    </TruncatedList>
                </GeminiScrollbar>
            </div>
        );
    },
}));
